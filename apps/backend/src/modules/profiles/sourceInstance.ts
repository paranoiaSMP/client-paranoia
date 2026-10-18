import fs from "node:fs";
import path from "node:path";

export interface SourceInstanceInfo {
	name?: string;
	minecraftVersion?: string;
	/** Seuls « fabric » et « vanilla » existent comme types de profil. */
	profileTypeId?: "fabric" | "vanilla";
	/** Loader detecte mais non gere par le launcher (forge, neoforge, quilt). */
	unsupportedLoader?: string;
}

function readJson(file: string): any | null {
	try {
		return JSON.parse(fs.readFileSync(file, "utf-8"));
	} catch {
		return null;
	}
}

/** Releve la version et le loader a partir d'une liste de composants MultiMC/Prism. */
function fromMmcPack(pack: any): SourceInstanceInfo {
	const info: SourceInstanceInfo = {};
	for (const c of Array.isArray(pack?.components) ? pack.components : []) {
		if (c.uid === "net.minecraft" && typeof c.version === "string") {
			info.minecraftVersion = c.version;
		} else if (c.uid === "net.fabricmc.fabric-loader") {
			info.profileTypeId = "fabric";
		} else if (c.uid === "org.quiltmc.quilt-loader") {
			info.unsupportedLoader = "quilt";
		} else if (c.uid === "net.minecraftforge") {
			info.unsupportedLoader = "forge";
		} else if (c.uid === "net.neoforged") {
			info.unsupportedLoader = "neoforge";
		}
	}
	return info;
}

/**
 * Devine la version et le loader d'une instance d'un autre launcher a partir
 * de son options.txt.
 *
 * <p>Sans cela, tout import partait en 1.21.1 vanilla: une instance 1.20.1
 * Fabric s'ouvrait avec la mauvaise version, et ses mods ne chargeaient plus.
 * Quand rien n'est reconnu, on rend un objet vide et l'appelant garde ses
 * valeurs par defaut -- deviner faux est pire que ne pas deviner.
 */
export function inspectSourceInstance(optionsPath: string): SourceInstanceInfo {
	const gameDir = path.dirname(optionsPath);
	// MultiMC/Prism: le jeu est dans <instance>/.minecraft, la config un cran au-dessus.
	const candidates = [gameDir, path.dirname(gameDir)];

	for (const dir of candidates) {
		const mmc = readJson(path.join(dir, "mmc-pack.json"));
		if (mmc) {
			const info = fromMmcPack(mmc);
			const cfg = path.join(dir, "instance.cfg");
			if (fs.existsSync(cfg)) {
				const match = /^name=(.+)$/m.exec(fs.readFileSync(cfg, "utf-8"));
				if (match?.[1]) info.name = match[1].trim();
			}
			return info;
		}

		// CurseForge App
		const curse = readJson(path.join(dir, "minecraftinstance.json"));
		if (curse) {
			const info: SourceInstanceInfo = {};
			if (typeof curse.name === "string") info.name = curse.name;
			const version = curse.baseModLoader?.minecraftVersion ?? curse.gameVersion;
			if (typeof version === "string") info.minecraftVersion = version;

			const loader = String(curse.baseModLoader?.name ?? "").toLowerCase();
			if (loader.startsWith("fabric")) info.profileTypeId = "fabric";
			else if (loader.startsWith("forge")) info.unsupportedLoader = "forge";
			else if (loader.startsWith("neoforge")) info.unsupportedLoader = "neoforge";
			else if (loader.startsWith("quilt")) info.unsupportedLoader = "quilt";
			return info;
		}
	}
	return {};
}

export interface SourceDescription extends SourceInstanceInfo {
	optionsPath: string;
	/** Mods actifs (.jar) dans le dossier mods de l'instance. */
	modCount: number;
}

/** Ce que l'import affiche d'une instance: ce qu'on en sait, plus le nombre de mods. */
export function describeSource(optionsPath: string): SourceDescription {
	let modCount = 0;
	try {
		modCount = fs
			.readdirSync(path.join(path.dirname(optionsPath), "mods"))
			.filter((name) => name.toLowerCase().endsWith(".jar")).length;
	} catch {
		// Pas de dossier mods: instance vanilla, zero mod.
	}
	return { optionsPath, modCount, ...inspectSourceInstance(optionsPath) };
}

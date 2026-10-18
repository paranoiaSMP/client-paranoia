import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
import { createProfile } from "./profiles.store.js";
import { importMrPack } from "./mrpack.service.js";
import { ensureInstanceLayout, instanceDir } from "../launcher/paths.js";
import { logger } from "../../logger.js";
import type { StoredLauncherProfile } from "./profiles.store.js";

export interface ArchiveImportResult {
	profile: StoredLauncherProfile;
	/** Ce qui n'a pas pu etre repris: affiche au joueur, jamais cache. */
	warnings: string[];
}

export class UnknownArchiveError extends Error {}

/**
 * Joint sans jamais sortir de {@code root}.
 *
 * <p>Une archive vient d'internet. Un nom d'entree comme {@code ../../x}
 * ecrirait hors de l'instance (zip-slip), donc on le refuse au lieu de
 * faire confiance au nom.
 */
function safeJoin(root: string, relative: string): string | null {
	const target = path.resolve(root, relative);
	return target === root || target.startsWith(root + path.sep) ? target : null;
}

function extractPrefix(zip: AdmZip, prefix: string, dest: string, warnings: string[]): number {
	let count = 0;
	for (const entry of zip.getEntries()) {
		if (entry.isDirectory || !entry.entryName.startsWith(prefix)) continue;

		const target = safeJoin(dest, entry.entryName.slice(prefix.length));
		if (!target) {
			warnings.push(`Fichier ignore (chemin suspect): ${entry.entryName}`);
			continue;
		}
		fs.mkdirSync(path.dirname(target), { recursive: true });
		fs.writeFileSync(target, entry.getData());
		count++;
	}
	return count;
}

function loaderOf(id: string): { type: "fabric" | "vanilla"; unsupported?: string } {
	const loader = id.split("-")[0]?.toLowerCase() ?? "";
	if (loader === "fabric") return { type: "fabric" };
	if (["forge", "neoforge", "quilt"].includes(loader)) return { type: "vanilla", unsupported: loader };
	return { type: "vanilla" };
}

/** CurseForge: manifest.json + overrides/, les mods etant a telecharger. */
async function importCurseForge(zip: AdmZip, manifest: any): Promise<ArchiveImportResult> {
	const warnings: string[] = [];
	const version = manifest.minecraft?.version;
	if (typeof version !== "string") {
		throw new UnknownArchiveError("Version de Minecraft introuvable dans le manifest CurseForge.");
	}

	const modLoaders: any[] = Array.isArray(manifest.minecraft?.modLoaders) ? manifest.minecraft.modLoaders : [];
	const primary = modLoaders.find((l) => l.primary) ?? modLoaders[0];
	const loader = loaderOf(String(primary?.id ?? ""));
	if (loader.unsupported) {
		warnings.push(`Le loader ${loader.unsupported} n'est pas gere: l'instance sera lancee en vanilla et ses mods ne chargeront pas.`);
	}

	const profile = createProfile({
		name: manifest.name || "Import CurseForge",
		minecraftVersion: version,
		profileTypeId: loader.type,
		graphicsModeId: "fancy",
		ramMb: 4096,
		resolution: "1920x1080",
	});
	await ensureInstanceLayout(profile.id);
	const dir = path.resolve(instanceDir(profile.id));

	const overrides = `${manifest.overrides || "overrides"}/`;
	extractPrefix(zip, overrides, dir, warnings);

	// Route de telechargement publique: elle redirige vers le CDN sans cle d'API.
	let missing = 0;
	const files: any[] = Array.isArray(manifest.files) ? manifest.files : [];
	const modsDir = path.join(dir, "mods");
	await Promise.all(
		files.map(async (f) => {
			try {
				const res = await fetch(`https://www.curseforge.com/api/v1/mods/${f.projectID}/files/${f.fileID}/download`, {
					redirect: "follow",
					signal: AbortSignal.timeout(60_000),
				});
				if (!res.ok) throw new Error(String(res.status));
				const name = decodeURIComponent(new URL(res.url).pathname.split("/").pop() || `${f.projectID}-${f.fileID}.jar`);
				const target = safeJoin(modsDir, name);
				if (!target) throw new Error("nom suspect");
				fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
			} catch (err) {
				missing++;
				logger.warn({ projectID: f.projectID, fileID: f.fileID, err: String(err) }, "[Import] mod CurseForge non telecharge");
			}
		}),
	);
	if (missing > 0) {
		warnings.push(`${missing} mod(s) sur ${files.length} n'ont pas pu etre telecharges: ajoute-les a la main dans le dossier mods.`);
	}
	return { profile, warnings };
}

/** Export MultiMC / Prism: mmc-pack.json + .minecraft/. */
async function importMmcExport(zip: AdmZip, packJson: any, prefix: string): Promise<ArchiveImportResult> {
	const warnings: string[] = [];
	const components: any[] = Array.isArray(packJson.components) ? packJson.components : [];
	const version = components.find((c) => c.uid === "net.minecraft")?.version;
	if (typeof version !== "string") {
		throw new UnknownArchiveError("Version de Minecraft introuvable dans mmc-pack.json.");
	}

	const has = (uid: string) => components.some((c) => c.uid === uid);
	for (const [uid, label] of [
		["org.quiltmc.quilt-loader", "quilt"],
		["net.minecraftforge", "forge"],
		["net.neoforged", "neoforge"],
	] as const) {
		if (has(uid)) warnings.push(`Le loader ${label} n'est pas gere: l'instance sera lancee en vanilla et ses mods ne chargeront pas.`);
	}

	let name = "Import Prism";
	const cfg = zip.getEntry(`${prefix}instance.cfg`);
	const match = cfg ? /^name=(.+)$/m.exec(cfg.getData().toString("utf8")) : null;
	if (match?.[1]) name = match[1].trim();

	const profile = createProfile({
		name,
		minecraftVersion: version,
		profileTypeId: has("net.fabricmc.fabric-loader") ? "fabric" : "vanilla",
		graphicsModeId: "fancy",
		ramMb: 4096,
		resolution: "1920x1080",
	});
	await ensureInstanceLayout(profile.id);
	const dir = path.resolve(instanceDir(profile.id));

	for (const sub of [".minecraft/", "minecraft/"]) {
		if (extractPrefix(zip, `${prefix}${sub}`, dir, warnings) > 0) break;
	}
	return { profile, warnings };
}

/**
 * Importe une archive d'un autre launcher en reconnaissant son format.
 *
 * <p>On regarde le contenu et non l'extension: un {@code .zip} peut etre
 * aussi bien un export CurseForge que Prism, et c'est lui qui le dit.
 */
export async function importArchive(archivePath: string): Promise<ArchiveImportResult> {
	if (!fs.existsSync(archivePath)) {
		throw new UnknownArchiveError(`Archive introuvable: ${archivePath}`);
	}
	const zip = new AdmZip(archivePath);

	if (zip.getEntry("modrinth.index.json")) {
		return { profile: await importMrPack(archivePath), warnings: [] };
	}

	const manifestEntry = zip.getEntry("manifest.json");
	if (manifestEntry) {
		const manifest = JSON.parse(manifestEntry.getData().toString("utf8"));
		if (manifest?.minecraft) return importCurseForge(zip, manifest);
	}

	// Prism/MultiMC range parfois tout dans un dossier racine portant le nom de l'instance.
	const mmcEntry = zip.getEntries().find((e) => /(^|\/)mmc-pack\.json$/.test(e.entryName));
	if (mmcEntry) {
		const prefix = mmcEntry.entryName.slice(0, mmcEntry.entryName.length - "mmc-pack.json".length);
		return importMmcExport(zip, JSON.parse(mmcEntry.getData().toString("utf8")), prefix);
	}

	throw new UnknownArchiveError(
		"Archive non reconnue. Formats gere : Modrinth (.mrpack), CurseForge (.zip), Prism / MultiMC / PolyMC (.zip), Lunar (.lcpack).",
	);
}

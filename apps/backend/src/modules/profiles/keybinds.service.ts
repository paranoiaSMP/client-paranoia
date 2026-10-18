import fs from "node:fs";
import path from "node:path";

/** Taille maximale lue: un options.txt reel fait quelques Ko. */
const MAX_OPTIONS_BYTES = 1024 * 1024;

export interface KeybindImportResult {
	/** Touches ecrites dans l'instance cible. */
	applied: number;
	/** Touches deja identiques, laissees telles quelles. */
	unchanged: number;
}

export class KeybindImportError extends Error {}

/**
 * Lit les touches d'un options.txt.
 *
 * <p>Seules les lignes {@code key_*} comptent: copier tout le fichier
 * ecraserait aussi la langue, le son et les graphismes que le joueur a
 * regles pour cette instance-ci.
 */
export function readKeybinds(optionsPath: string): Map<string, string> {
	const stat = fs.statSync(optionsPath);
	if (!stat.isFile() || stat.size > MAX_OPTIONS_BYTES) {
		throw new KeybindImportError("Ce fichier n'est pas un options.txt valide.");
	}

	const keys = new Map<string, string>();
	// \r?\n: un options.txt venu de Windows est en CRLF.
	for (const line of fs.readFileSync(optionsPath, "utf-8").split(/\r?\n/)) {
		const separator = line.indexOf(":");
		if (separator <= 0) continue;

		const key = line.slice(0, separator);
		if (key.startsWith("key_")) {
			keys.set(key, line.slice(separator + 1).trim());
		}
	}
	return keys;
}

/**
 * Deux ecritures incompatibles des touches.
 *
 * <p>Avant la 1.13 une touche s'ecrit en code numerique ({@code key_key.forward:17}),
 * ensuite en nom ({@code key_key.forward:key.keyboard.w}). Copier l'une dans
 * l'autre donnerait des touches que le jeu ne sait pas lire, et il les
 * remplacerait par ses valeurs par defaut sans rien dire.
 */
function styleOf(keys: Map<string, string>): "legacy" | "modern" | null {
	for (const value of keys.values()) {
		if (/^-?\d+$/.test(value)) return "legacy";
		if (value.startsWith("key.")) return "modern";
	}
	return null;
}

function setOption(content: string, key: string, value: string): string {
	const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const pattern = new RegExp(`^${escaped}:.*$`, "m");
	const line = `${key}:${value}`;

	if (pattern.test(content)) {
		return content.replace(pattern, line);
	}
	const separated = content.length > 0 && !content.endsWith("\n") ? content + "\n" : content;
	return separated + line + "\n";
}

/** Copie les touches de {@code sourceOptionsPath} dans l'options.txt de {@code gameDir}. */
export function importKeybinds(gameDir: string, sourceOptionsPath: string): KeybindImportResult {
	if (path.basename(sourceOptionsPath) !== "options.txt" || !fs.existsSync(sourceOptionsPath)) {
		throw new KeybindImportError("options.txt introuvable pour l'instance source.");
	}

	const source = readKeybinds(sourceOptionsPath);
	if (source.size === 0) {
		throw new KeybindImportError(
			"Aucune touche personnalisee dans cette instance: lance-la une fois pour que le jeu les ecrive.",
		);
	}

	const targetPath = path.join(gameDir, "options.txt");
	const existing = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, "utf-8") : "";

	const sourceStyle = styleOf(source);
	const targetStyle = existing
		? styleOf(
				new Map(
					existing
						.split(/\r?\n/)
						.filter((l) => l.startsWith("key_"))
						.map((l) => [l.slice(0, l.indexOf(":")), l.slice(l.indexOf(":") + 1).trim()]),
				),
			)
		: null;

	if (sourceStyle && targetStyle && sourceStyle !== targetStyle) {
		throw new KeybindImportError(
			"Les deux instances ne sont pas de la meme epoque: les touches d'avant la 1.13 ne se lisent pas dans les versions recentes, et inversement.",
		);
	}

	let content = existing;
	let applied = 0;
	let unchanged = 0;
	for (const [key, value] of source) {
		if (new RegExp(`^${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:${value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "m").test(content)) {
			unchanged++;
			continue;
		}
		content = setOption(content, key, value);
		applied++;
	}

	fs.mkdirSync(gameDir, { recursive: true });
	fs.writeFileSync(targetPath, content, "utf-8");
	return { applied, unchanged };
}

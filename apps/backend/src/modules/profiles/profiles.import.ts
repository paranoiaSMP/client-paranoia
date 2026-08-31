// apps/backend/src/modules/profiles/profiles.importer.ts
import fs from "node:fs";
import path from "node:path";
import { createProfile } from "./profiles.store.js";
import { importLunarPack } from "./lunar.importer.js";

export async function importProfilesFromPaths(paths: string[]) {
	for (const filePath of paths) {
		console.log("[Import] Traitement du fichier:", filePath);
		if (!fs.existsSync(filePath)) {
			console.error("[Import] Le fichier n'existe pas:", filePath);
			continue;
		}

		const ext = path.extname(filePath).toLowerCase();
		console.log("[Import] Extension détectée:", ext);
		
		if (ext === ".paraconf") {
			console.log("[Import] Traitement paraconf...");
			const content = JSON.parse(fs.readFileSync(filePath, "utf-8"));
			createProfile({
				name: content.name || "Profil importé",
				minecraftVersion: content.minecraftVersion || "1.20.4",
				profileTypeId: content.profileTypeId || "vanilla",
				graphicsModeId: content.graphicsModeId || "fast",
				ramMb: content.ramMb || 4096,
				resolution: content.resolution || "1920x1080",
				optionsTxtPath: content.optionsTxtPath
			});
		} else if (ext === ".lcpack") {
			console.log("[Import] Traitement lcpack (Lunar)...");
			await importLunarPack(filePath);
		} else if (ext === ".mrpack" || ext === ".zip") {
            // Lecture ZIP (CurseForge/Modrinth/Prism) à faire avec jszip
			createProfile({
				name: path.basename(filePath, ext),
				minecraftVersion: "1.20.4",
				profileTypeId: "fabric",
				graphicsModeId: "fast",
				ramMb: 4096,
				resolution: "1920x1080"
			});
		} else if (fs.statSync(filePath).isDirectory()) {
            // Lunar/Dawn
			createProfile({
				name: path.basename(filePath),
				minecraftVersion: "1.20.4",
				profileTypeId: "vanilla",
				graphicsModeId: "fast",
				ramMb: 4096,
				resolution: "1920x1080",
				optionsTxtPath: path.join(filePath, "options.txt")
			});
		}
	}
}
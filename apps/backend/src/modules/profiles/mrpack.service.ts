import { existsSync, mkdirSync, createWriteStream, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import AdmZip from "adm-zip";
import axios from "axios";
import { createProfile } from "./profiles.store.js";
import { ensureInstanceLayout, instanceDir } from "../launcher/paths.js";
import { ensureFabricApi } from "../launcher/fabricApi.js";
import { pipeline } from "node:stream/promises";
import { logger } from "../../logger.js";

/**
 * Joint sans sortir de l'instance: un .mrpack vient d'internet, et un chemin
 * comme « ../../x » ecrirait hors du dossier (zip-slip).
 */
function insideInstance(root: string, relative: string): string | null {
  const base = resolve(root);
  const target = resolve(base, relative);
  return target.startsWith(base + sep) ? target : null;
}

export async function importMrPack(archivePath: string) {
  if (!existsSync(archivePath)) {
    throw new Error("Archive introuvable: " + archivePath);
  }

  const zip = new AdmZip(archivePath);
  const zipEntries = zip.getEntries();
  
  const indexEntry = zipEntries.find(e => e.entryName === "modrinth.index.json");
  if (!indexEntry) {
    throw new Error("L'archive n'est pas un fichier .mrpack valide (modrinth.index.json introuvable).");
  }

  const indexData = JSON.parse(indexEntry.getData().toString("utf8"));
  
  const minecraftVersion = indexData.dependencies?.minecraft;
  if (!minecraftVersion) {
    throw new Error("Version de Minecraft introuvable dans le .mrpack.");
  }

  const fabricVersion = indexData.dependencies?.["fabric-loader"];
  const profileType = fabricVersion ? "fabric" : "vanilla";
  
  // Create profile
  const profile = createProfile({
    name: indexData.name || "Import Modrinth",
    minecraftVersion: minecraftVersion,
    profileTypeId: profileType,
    graphicsModeId: "fancy",
    ramMb: 4096,
    resolution: "1920x1080",
  });
  
  await ensureInstanceLayout(profile.id);
  const instDir = instanceDir(profile.id);

  // Download files
  if (Array.isArray(indexData.files)) {
    for (const file of indexData.files) {
      if (file.downloads && file.downloads.length > 0) {
        const url = file.downloads[0];
        const targetPath = insideInstance(instDir, file.path); // e.g. "mods/sodium.jar"
        if (!targetPath) {
          logger.warn(`Chemin suspect ignore dans le mrpack: ${file.path}`);
          continue;
        }
        const targetDir = dirname(targetPath);
        
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true });
        }
        
        try {
          logger.info(`Téléchargement de ${url} vers ${targetPath}`);
          const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream'
          });
          
          await pipeline(response.data, createWriteStream(targetPath));
        } catch (e) {
          console.error(`Échec du téléchargement de ${url}:`, e);
        }
      }
    }
  }

  // Extract overrides
  const overridesPrefix = "overrides/";
  for (const entry of zipEntries) {
    if (entry.entryName.startsWith(overridesPrefix) && !entry.isDirectory) {
      const relativePath = entry.entryName.substring(overridesPrefix.length);
      const targetPath = insideInstance(instDir, relativePath);
      if (!targetPath) {
        logger.warn(`Chemin suspect ignore dans les overrides: ${entry.entryName}`);
        continue;
      }
      const targetDir = dirname(targetPath);

      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }

      // Ecrit avant de rendre la main: la creation du profil promettait une
      // instance complete alors que ses fichiers de config s'ecrivaient encore.
      writeFileSync(targetPath, entry.getData());
    }
  }

  // Extract Lunar/Custom standard zips (if no overrides folder but just root)
  // But wait, this is strictly mrpack!

  // Ensure Fabric API is ready
  void ensureFabricApi(instDir, minecraftVersion, () => {}).catch(e => console.warn(e));

  return profile;
}

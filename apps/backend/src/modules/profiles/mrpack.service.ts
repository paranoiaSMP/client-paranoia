import { existsSync, mkdirSync, createWriteStream, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import AdmZip from "adm-zip";
import axios from "axios";
import { createProfile } from "./profiles.store.js";
import { ensureInstanceLayout, instanceDir } from "../launcher/paths.js";
import { ensureFabricApi } from "../launcher/fabricApi.js";
import { pipeline } from "node:stream/promises";

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
        const targetPath = join(instDir, file.path); // file.path e.g. "mods/sodium.jar"
        const targetDir = dirname(targetPath);
        
        if (!existsSync(targetDir)) {
          mkdirSync(targetDir, { recursive: true });
        }
        
        try {
          console.log(`Téléchargement de ${url} vers ${targetPath}`);
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
      const targetPath = join(instDir, relativePath);
      const targetDir = dirname(targetPath);
      
      if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
      }
      
      const content = entry.getData();
      import("node:fs").then(fs => {
        fs.writeFileSync(targetPath, content);
      });
    }
  }

  // Extract Lunar/Custom standard zips (if no overrides folder but just root)
  // But wait, this is strictly mrpack!

  // Ensure Fabric API is ready
  void ensureFabricApi(instDir, minecraftVersion, () => {}).catch(e => console.warn(e));

  return profile;
}

import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import type { FileArtifact } from "@paranoia/contracts";

export async function downloadArtifacts(
  rootPath: string,
  artifacts: FileArtifact[],
  onProgress: (text: string, percentage: number) => void
): Promise<void> {
  const totalArtifacts = artifacts.length;

  let i = 0;
  for (const artifact of artifacts) {
    i++;
    const targetFilePath = path.join(rootPath, artifact.targetPath);
    const targetDir = path.dirname(targetFilePath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    if (fs.existsSync(targetFilePath)) {
      const stats = fs.statSync(targetFilePath);
      if (stats.size === artifact.size) {
        // Déjà téléchargé et la taille correspond
        continue;
      }
    }

    onProgress(`Telechargement de ${artifact.fileName} (${i + 1}/${totalArtifacts})...`, 0);

    try {
      const response = await axios({
        url: artifact.downloadUrl,
        method: "GET",
        responseType: "stream",
      });

      const totalLength = parseInt(
        (response.headers["content-length"] as string) || String(artifact.size),
        10
      );
      let downloadedLength = 0;

      await new Promise<void>((resolve, reject) => {
        const writer = fs.createWriteStream(targetFilePath);
        
        response.data.on("data", (chunk: Buffer) => {
          downloadedLength += chunk.length;
          if (totalLength > 0) {
            const percentage = Math.round((downloadedLength / totalLength) * 100);
            onProgress(`Telechargement de ${artifact.fileName} (${i + 1}/${totalArtifacts})...`, percentage);
          }
        });
        
        writer.on("finish", () => resolve());
        writer.on("error", (err) => reject(err));
        
        response.data.pipe(writer);
      });
    } catch (err) {
      if (artifact.optional) {
        console.warn(`Impossible de telecharger l'artefact optionnel ${artifact.fileName}:`, err);
      } else {
        throw new Error(`Echec du telechargement de ${artifact.fileName}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  onProgress("Tous les fichiers ont ete telecharges.", 100);
}

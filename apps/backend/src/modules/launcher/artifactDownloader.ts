import fs from "node:fs";
import type { FileArtifact } from "@paranoia/contracts";
import {
  downloadVerified,
  hashFile,
  resolveInsideRoot,
  safeUnlink,
} from "./verifiedDownload.js";

export async function downloadArtifacts(
  rootPath: string,
  artifacts: FileArtifact[],
  onProgress: (text: string, percentage: number) => void,
): Promise<void> {
  const totalArtifacts = artifacts.length;

  for (let i = 0; i < totalArtifacts; i++) {
    const artifact = artifacts[i]!;
    const label = `${artifact.fileName} (${i + 1}/${totalArtifacts})`;
    const expected = artifact.sha256.trim().toLowerCase();

    try {
      const targetFilePath = resolveInsideRoot(rootPath, artifact.targetPath);

      // Un fichier deja present n'est reutilise que si son empreinte correspond:
      // la taille seule laissait passer un fichier corrompu ou substitue.
      if (fs.existsSync(targetFilePath)) {
        if ((await hashFile(targetFilePath, "sha256")) === expected) {
          continue;
        }
        await safeUnlink(targetFilePath);
      }

      onProgress(`Telechargement de ${label}...`, 0);
      await downloadVerified(
        artifact.downloadUrl,
        targetFilePath,
        { algorithm: "sha256", value: expected },
        (percentage) => onProgress(`Telechargement de ${label}...`, percentage),
      );
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      if (artifact.optional) {
        console.warn(`Artefact optionnel ignore (${artifact.fileName}):`, reason);
        continue;
      }
      throw new Error(
        `Echec du telechargement de ${artifact.fileName}: ${reason}`,
      );
    }
  }

  onProgress("Tous les fichiers ont ete telecharges.", 100);
}

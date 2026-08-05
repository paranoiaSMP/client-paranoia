import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import axios from "axios";
import type { FileArtifact } from "@paranoia/contracts";

const ALLOWED_PROTOCOLS = new Set(["https:"]);

/**
 * Resolve `targetPath` under `rootPath` and refuse anything that escapes it.
 * The manifest comes from a remote catalog, so a crafted `../../` would
 * otherwise let it write anywhere the backend process can reach.
 */
function resolveInsideRoot(rootPath: string, targetPath: string): string {
  const root = path.resolve(rootPath);
  const resolved = path.resolve(root, targetPath);
  const rel = path.relative(root, resolved);

  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `Chemin d'artefact refuse (sort du dossier d'installation): ${targetPath}`,
    );
  }

  return resolved;
}

function assertDownloadUrl(downloadUrl: string): URL {
  let url: URL;
  try {
    url = new URL(downloadUrl);
  } catch {
    throw new Error(`URL d'artefact invalide: ${downloadUrl}`);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error(
      `Protocole refuse pour ${url.href} (https requis, recu ${url.protocol})`,
    );
  }

  return url;
}

async function sha256OfFile(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest("hex");
}

async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // le fichier n'existe pas ou a deja ete supprime
  }
}

/**
 * Download one artifact, hashing the stream on the fly and only publishing the
 * file at its final path once the digest matches the manifest.
 */
async function downloadOne(
  artifact: FileArtifact,
  targetFilePath: string,
  onChunkProgress: (percentage: number) => void,
): Promise<void> {
  const url = assertDownloadUrl(artifact.downloadUrl);
  const expected = artifact.sha256.trim().toLowerCase();

  await fs.promises.mkdir(path.dirname(targetFilePath), { recursive: true });

  const partPath = `${targetFilePath}.part`;
  await safeUnlink(partPath);

  const response = await axios({
    url: url.href,
    method: "GET",
    responseType: "stream",
    maxRedirects: 5,
    timeout: 60_000,
  });

  const totalLength = Number.parseInt(
    (response.headers["content-length"] as string) || String(artifact.size),
    10,
  );

  const hash = createHash("sha256");
  let downloadedLength = 0;

  response.data.on("data", (chunk: Buffer) => {
    hash.update(chunk);
    downloadedLength += chunk.length;
    if (totalLength > 0) {
      onChunkProgress(Math.round((downloadedLength / totalLength) * 100));
    }
  });

  try {
    // pipeline() propage les erreurs des deux flux et detruit le writer,
    // contrairement au pipe() manuel qui laissait un fichier partiel derriere.
    await pipeline(response.data, fs.createWriteStream(partPath));

    const actual = hash.digest("hex");
    if (actual !== expected) {
      throw new Error(
        `empreinte SHA-256 invalide pour ${artifact.fileName} ` +
          `(attendu ${expected}, recu ${actual})`,
      );
    }

    await fs.promises.rename(partPath, targetFilePath);
  } catch (err) {
    await safeUnlink(partPath);
    throw err;
  }
}

export async function downloadArtifacts(
  rootPath: string,
  artifacts: FileArtifact[],
  onProgress: (text: string, percentage: number) => void,
): Promise<void> {
  const totalArtifacts = artifacts.length;

  for (let i = 0; i < totalArtifacts; i++) {
    const artifact = artifacts[i]!;
    const label = `${artifact.fileName} (${i + 1}/${totalArtifacts})`;

    try {
      const targetFilePath = resolveInsideRoot(rootPath, artifact.targetPath);

      // Un fichier deja present n'est reutilise que si son empreinte correspond:
      // la taille seule laissait passer un fichier corrompu ou substitue.
      if (fs.existsSync(targetFilePath)) {
        const actual = await sha256OfFile(targetFilePath);
        if (actual === artifact.sha256.trim().toLowerCase()) {
          continue;
        }
        await safeUnlink(targetFilePath);
      }

      onProgress(`Telechargement de ${label}...`, 0);
      await downloadOne(artifact, targetFilePath, (percentage) => {
        onProgress(`Telechargement de ${label}...`, percentage);
      });
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

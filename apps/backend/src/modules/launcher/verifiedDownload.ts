import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import axios from "axios";

const ALLOWED_PROTOCOLS = new Set(["https:"]);

export type Digest = {
  algorithm: "sha1" | "sha256" | "sha512";
  value: string;
};

/**
 * Resolve `relativePath` under `rootPath` and refuse anything that escapes it.
 * Paths come from remote catalogs and third-party APIs, so a crafted `../../`
 * would otherwise let them write anywhere the process can reach.
 */
export function resolveInsideRoot(
  rootPath: string,
  relativePath: string,
): string {
  const root = path.resolve(rootPath);
  const resolved = path.resolve(root, relativePath);
  const rel = path.relative(root, resolved);

  if (rel === "" || rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error(
      `Chemin refuse (sort du dossier d'installation): ${relativePath}`,
    );
  }

  return resolved;
}

export function assertDownloadUrl(downloadUrl: string): URL {
  let url: URL;
  try {
    url = new URL(downloadUrl);
  } catch {
    throw new Error(`URL invalide: ${downloadUrl}`);
  }

  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    throw new Error(
      `Protocole refuse pour ${url.href} (https requis, recu ${url.protocol})`,
    );
  }

  return url;
}

export async function hashFile(
  filePath: string,
  algorithm: Digest["algorithm"],
): Promise<string> {
  const hash = createHash(algorithm);
  await pipeline(fs.createReadStream(filePath), hash);
  return hash.digest("hex");
}

export async function safeUnlink(filePath: string): Promise<void> {
  try {
    await fs.promises.unlink(filePath);
  } catch {
    // le fichier n'existe pas ou a deja ete supprime
  }
}

/**
 * Download to `targetPath`, hashing the stream on the fly and only publishing
 * the file once the digest matches. A mismatched or interrupted download never
 * leaves a usable file behind.
 */
export async function downloadVerified(
  downloadUrl: string,
  targetPath: string,
  digest: Digest,
  onProgress?: (percentage: number) => void,
): Promise<void> {
  const url = assertDownloadUrl(downloadUrl);
  const expected = digest.value.trim().toLowerCase();

  await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });

  const partPath = `${targetPath}.part`;
  await safeUnlink(partPath);

  const response = await axios({
    url: url.href,
    method: "GET",
    responseType: "stream",
    maxRedirects: 5,
    timeout: 60_000,
  });

  const totalLength = Number.parseInt(
    (response.headers["content-length"] as string) || "0",
    10,
  );

  const hash = createHash(digest.algorithm);
  let downloaded = 0;

  response.data.on("data", (chunk: Buffer) => {
    hash.update(chunk);
    downloaded += chunk.length;
    if (totalLength > 0 && onProgress) {
      onProgress(Math.round((downloaded / totalLength) * 100));
    }
  });

  try {
    // pipeline() propage les erreurs des deux flux et detruit le writer,
    // contrairement a un pipe() manuel qui laisserait un fichier partiel.
    await pipeline(response.data, fs.createWriteStream(partPath));

    const actual = hash.digest("hex");
    if (actual !== expected) {
      throw new Error(
        `empreinte ${digest.algorithm.toUpperCase()} invalide ` +
          `(attendu ${expected}, recu ${actual})`,
      );
    }

    await fs.promises.rename(partPath, targetPath);
  } catch (err) {
    await safeUnlink(partPath);
    throw err;
  }
}

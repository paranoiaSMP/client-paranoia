import fs from "node:fs";
import path from "node:path";
import type { ClientModArtifact } from "@paranoia/contracts";
import { downloadVerified, hashFile, safeUnlink } from "./verifiedDownload.js";

/**
 * Le mod Paranoia est installe hors du dossier `mods` de l'instance, dans un
 * dossier gere par le launcher, et charge via `-Dfabric.addMods`.
 *
 * <p>Ce que ca apporte reellement: le joueur ne peut pas le supprimer par
 * accident et casser son client, ni en garder une vieille copie qui traine, ni
 * le melanger aux mods qu'il installe depuis Modrinth. Le dossier `mods` reste
 * le sien.
 *
 * <p>Ce que ca n'apporte pas: une protection. Le fichier doit etre lisible sur
 * le disque pour que la JVM le charge, son chemin apparait en clair dans la
 * ligne de commande du processus, et du bytecode Java se decompile. Rendre une
 * copie inutile releve du serveur, pas du launcher.
 */

/** Dossier des fichiers geres par le launcher, partage entre les profils. */
export function runtimeDir(rootPath: string): string {
  return path.join(rootPath, "runtime");
}

/**
 * Cherche un jar local du client Paranoia dans runtime/ ou dans le build du projet.
 */
export async function findLocalClientMod(
  rootPath: string,
  minecraftVersion?: string,
  preferredFileName?: string,
): Promise<string | null> {
  const directory = runtimeDir(rootPath);

  // 1. Chercher dans le dossier runtime du launcher
  try {
    if (fs.existsSync(directory)) {
      const runtimeFiles = await fs.promises.readdir(directory);
      if (preferredFileName && runtimeFiles.includes(preferredFileName)) {
        return path.join(directory, preferredFileName);
      }
      if (minecraftVersion) {
        const match = runtimeFiles.find((f) =>
          f.toLowerCase().startsWith("paranoia-client") &&
          f.toLowerCase().endsWith(".jar") &&
          !f.toLowerCase().endsWith("-sources.jar") &&
          f.includes(`+${minecraftVersion}`)
        );
        if (match) return path.join(directory, match);
      }
      const anyJar = runtimeFiles.find((f) =>
        f.toLowerCase().startsWith("paranoia-client") &&
        f.toLowerCase().endsWith(".jar") &&
        !f.toLowerCase().endsWith("-sources.jar")
      );
      if (anyJar) return path.join(directory, anyJar);
    }
  } catch {
    // Erreur de lecture ignoree
  }

  // 2. Chercher dans les builds du depot local (cas dev / compilation locale)
  const candidateDirs: string[] = [];
  if (minecraftVersion) {
    candidateDirs.push(
      path.resolve(process.cwd(), "apps/client-mod/versions", minecraftVersion, "build/libs"),
      path.resolve(process.cwd(), "versions", minecraftVersion, "build/libs"),
    );
  }
  candidateDirs.push(
    path.resolve(process.cwd(), "apps/client-mod/build/libs"),
  );

  for (const cDir of candidateDirs) {
    try {
      if (fs.existsSync(cDir)) {
        const files = await fs.promises.readdir(cDir);
        const jar = files.find((f) =>
          f.toLowerCase().startsWith("paranoia-client") &&
          f.toLowerCase().endsWith(".jar") &&
          !f.toLowerCase().endsWith("-sources.jar") &&
          (!minecraftVersion || f.includes(`+${minecraftVersion}`))
        );
        if (jar) {
          const sourcePath = path.join(cDir, jar);
          await fs.promises.mkdir(directory, { recursive: true });
          const destPath = path.join(directory, jar);
          await fs.promises.copyFile(sourcePath, destPath);
          return destPath;
        }
      }
    } catch {
      // ignore
    }
  }

  return null;
}

/**
 * Telecharge le mod si besoin et rend son chemin absolu.
 * Repli sur la copie locale si le manifeste n'en declare pas ou si le telechargement echoue.
 *
 * @returns le chemin du jar, ou null si introuvable.
 */
export async function ensureClientMod(
  rootPath: string,
  clientMod: ClientModArtifact | undefined,
  onProgress: (text: string, percentage: number) => void,
  minecraftVersion?: string,
): Promise<string | null> {
  const directory = runtimeDir(rootPath);
  await fs.promises.mkdir(directory, { recursive: true });

  if (clientMod) {
    const target = path.join(directory, path.basename(clientMod.fileName));
    const expected = clientMod.sha256.trim().toLowerCase();

    if (fs.existsSync(target)) {
      if ((await hashFile(target, "sha256")) === expected) {
        return target;
      }
    }

    try {
      onProgress(`Telechargement du client Paranoia...`, 0);
      await downloadVerified(
        clientMod.downloadUrl,
        target,
        { algorithm: "sha256", value: expected },
        (percentage) => onProgress("Telechargement du client Paranoia...", percentage),
      );

      await removeOtherVersions(directory, path.basename(target), minecraftVersion);
      return target;
    } catch (err) {
      console.warn(
        `[Launcher] Echec du telechargement distant du client Paranoia (${clientMod.downloadUrl}):`,
        err,
      );
    }
  }

  // Repli local si telechargement echoue ou si pas de mod dans le manifeste
  const localJar = await findLocalClientMod(rootPath, minecraftVersion, clientMod?.fileName);
  if (localJar) {
    console.log(`[Launcher] Client Paranoia local retenu: ${path.basename(localJar)}`);
    return localJar;
  }

  return null;
}

/**
 * Supprime les jars laisses par les versions precedentes pour la meme version de Minecraft.
 */
async function removeOtherVersions(
  directory: string,
  keep: string,
  minecraftVersion?: string,
): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.promises.readdir(directory);
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((name) => {
        if (name === keep || !/^paranoia-client.*\.jar$/i.test(name)) return false;
        if (minecraftVersion && !name.includes(`+${minecraftVersion}`)) return false;
        return true;
      })
      .map((name) => safeUnlink(path.join(directory, name))),
  );
}

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
 * Telecharge le mod si besoin et rend son chemin absolu.
 *
 * @returns le chemin du jar, ou null si le manifeste n'en declare pas.
 */
export async function ensureClientMod(
  rootPath: string,
  clientMod: ClientModArtifact | undefined,
  onProgress: (text: string, percentage: number) => void,
): Promise<string | null> {
  if (!clientMod) {
    // Catalogue sans mod client (version non couverte, ou release ou le jar
    // n'a pas ete publie): on lance sans, plutot que d'echouer.
    return null;
  }

  const directory = runtimeDir(rootPath);
  await fs.promises.mkdir(directory, { recursive: true });

  // Le nom vient du manifeste: on ne garde que le nom de fichier pour qu'il ne
  // puisse pas designer un autre dossier.
  const target = path.join(directory, path.basename(clientMod.fileName));
  const expected = clientMod.sha256.trim().toLowerCase();

  if (fs.existsSync(target)) {
    if ((await hashFile(target, "sha256")) === expected) {
      return target;
    }
    // Empreinte differente: version precedente, ou fichier altere. Dans les
    // deux cas on le remplace.
    await safeUnlink(target);
  }

  onProgress(`Telechargement du client Paranoia...`, 0);
  await downloadVerified(
    clientMod.downloadUrl,
    target,
    { algorithm: "sha256", value: expected },
    (percentage) => onProgress("Telechargement du client Paranoia...", percentage),
  );

  await removeOtherVersions(directory, path.basename(target));
  return target;
}

/**
 * Supprime les jars laisses par les versions precedentes.
 *
 * <p>Pas pour eviter un conflit: `fabric.addMods` recoit un chemin precis, les
 * autres fichiers du dossier ne sont donc jamais charges. C'est pour ne pas
 * accumuler un jar mort par mise a jour, indefiniment, chez chaque joueur.
 */
async function removeOtherVersions(directory: string, keep: string): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.promises.readdir(directory);
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((name) => name !== keep && /^paranoia-client.*\.jar$/i.test(name))
      .map((name) => safeUnlink(path.join(directory, name))),
  );
}

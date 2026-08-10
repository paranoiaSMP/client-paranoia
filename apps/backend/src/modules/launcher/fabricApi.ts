import fs from "node:fs";
import path from "node:path";
import { listProjectVersions } from "../mods/modrinth.service.js";
import { downloadVerified, hashFile, safeUnlink } from "./verifiedDownload.js";

/**
 * Installe Fabric API dans le dossier `mods` du profil.
 *
 * <p>Le launcher installait le loader Fabric mais jamais Fabric API, qui est un
 * mod a part entiere. Or le client Paranoia le declare en dependance
 * obligatoire, comme la quasi-totalite des mods Fabric: sans lui, le loader
 * refuse de charger le mod, et le joueur voit un jeu qui demarre sans que rien
 * ne reponde.
 *
 * <p>Il va bien dans `mods`, contrairement au mod Paranoia: c'est une
 * bibliotheque publique dont les mods installes par le joueur ont besoin aussi.
 */

const FABRIC_API_PROJECT = "fabric-api";

export async function ensureFabricApi(
  gameDir: string,
  minecraftVersion: string,
  onProgress: (text: string, percentage: number) => void,
): Promise<string | null> {
  const modsDir = path.join(gameDir, "mods");
  await fs.promises.mkdir(modsDir, { recursive: true });

  onProgress("Recherche de Fabric API...", 0);

  const versions = await listProjectVersions(FABRIC_API_PROJECT, {
    gameVersion: minecraftVersion,
    loader: "fabric",
  });

  const latest = versions[0];
  if (!latest) {
    // Version de Minecraft trop recente pour Fabric API, ou Modrinth muet.
    return null;
  }

  const target = path.join(modsDir, path.basename(latest.fileName));
  const expected = latest.sha512.trim().toLowerCase();

  if (fs.existsSync(target)) {
    if ((await hashFile(target, "sha512")) === expected) {
      onProgress("Fabric API deja installe", 100);
      return target;
    }
    await safeUnlink(target);
  }

  await downloadVerified(
    latest.downloadUrl,
    target,
    { algorithm: "sha512", value: expected },
    (percentage) => onProgress("Telechargement de Fabric API...", percentage),
  );

  await removeOtherVersions(modsDir, path.basename(target));
  return target;
}

/**
 * Supprime les Fabric API laisses par les versions precedentes.
 *
 * <p>Ici, contrairement au mod Paranoia, ils sont dans `mods`: deux versions du
 * meme mod y coexistant, le loader refuserait de demarrer.
 */
async function removeOtherVersions(modsDir: string, keep: string): Promise<void> {
  let entries: string[];
  try {
    entries = await fs.promises.readdir(modsDir);
  } catch {
    return;
  }

  await Promise.all(
    entries
      .filter((name) => name !== keep && /^fabric-api-.*\.jar$/i.test(name))
      .map((name) => safeUnlink(path.join(modsDir, name))),
  );
}

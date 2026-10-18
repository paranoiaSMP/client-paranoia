import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { downloadVerified } from "../launcher/verifiedDownload.js";
import { importArchive, type ArchiveImportResult } from "../profiles/archive.importer.js";
import { updateProfile } from "../profiles/profiles.store.js";
import { listProjectVersions } from "./modrinth.service.js";

export class ModpackError extends Error {}

/**
 * Cree une instance a partir d'un modpack Modrinth.
 *
 * <p>Un modpack n'est pas un contenu qu'on pose dans une instance: c'est une
 * instance entiere. On telecharge donc son .mrpack, verifie par son hash, puis
 * on le confie a l'importeur d'archives, qui sait deja le lire -- une seule
 * facon de transformer un mrpack en profil, qu'il vienne d'un fichier ou du
 * catalogue.
 *
 * <p>Sans {@code versionId}, on prend la plus recente, en preferant celle qui
 * cible la version de Minecraft demandee.
 */
export async function installModpack(opts: {
  projectId: string;
  versionId?: string | undefined;
  gameVersion?: string | undefined;
  /** Le titre du catalogue: celui que le joueur a clique, et non le nom interne du .mrpack. */
  name?: string | undefined;
}): Promise<ArchiveImportResult> {
  let versions = await listProjectVersions(opts.projectId, {
    gameVersion: opts.gameVersion,
    loader: undefined,
  });
  if (versions.length === 0 && opts.gameVersion) {
    versions = await listProjectVersions(opts.projectId, { loader: undefined, gameVersion: undefined });
  }

  const version = opts.versionId
    ? versions.find((v) => v.versionId === opts.versionId)
    : versions[0];
  if (!version) {
    throw new ModpackError("Aucune version telechargeable pour ce modpack.");
  }
  if (!version.fileName.toLowerCase().endsWith(".mrpack")) {
    throw new ModpackError("Ce modpack n'est pas distribue au format .mrpack.");
  }

  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "paranoia-modpack-"));
  try {
    const target = path.join(dir, path.basename(version.fileName));
    await downloadVerified(version.downloadUrl, target, {
      algorithm: "sha512",
      value: version.sha512,
    });
    const result = await importArchive(target);
    // Le nom interne d'un .mrpack est libre: « 2.4.7 SERVER » pour un pack que
    // le catalogue appelle « Sodium Plus ». Le joueur retrouve ce qu'il a clique.
    if (opts.name) {
      const renamed = updateProfile(result.profile.id, { name: opts.name });
      if (renamed) return { ...result, profile: renamed };
    }
    return result;
  } finally {
    // Le .mrpack n'a plus d'utilite une fois l'instance creee, et il peut peser
    // plusieurs dizaines de Mo.
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
}

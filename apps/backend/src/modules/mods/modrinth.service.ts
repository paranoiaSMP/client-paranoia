import fs from "node:fs";
import path from "node:path";
import { instanceDir } from "../launcher/paths.js";
import {
  downloadVerified,
  resolveInsideRoot,
  safeUnlink,
} from "../launcher/verifiedDownload.js";

const MODRINTH_API =
  process.env.MODRINTH_API_BASE_URL ?? "https://api.modrinth.com/v2";

// Modrinth demande un User-Agent identifiant l'application et un contact.
const USER_AGENT = "paranoiaSMP/paranoia-client (contact@paranoia.gg)";

export interface ModSearchHit {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  iconUrl: string | null;
  categories: string[];
}

export interface ModVersion {
  versionId: string;
  name: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: string[];
  fileName: string;
  downloadUrl: string;
  size: number;
  sha512: string;
  datePublished: string;
}

export interface InstalledMod {
  fileName: string;
  size: number;
  installedAt: string;
}

/**
 * Marks a failure as coming from Modrinth rather than from our own code, so the
 * route can answer 502 with a message the player can act on instead of the
 * generic "internal server error".
 */
export class ModrinthUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModrinthUnavailableError";
  }
}

async function modrinthGet<T>(
  pathname: string,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(`${MODRINTH_API}${pathname}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ModrinthUnavailableError(
      `Modrinth est injoignable. Verifie ta connexion internet. (${reason})`,
    );
  }

  if (!response.ok) {
    throw new ModrinthUnavailableError(
      response.status === 429
        ? "Trop de requetes vers Modrinth, reessaie dans une minute."
        : `Modrinth a repondu ${response.status}.`,
    );
  }

  return (await response.json()) as T;
}

/**
 * Search mods, restricted to the loader and game version of the profile so the
 * player cannot install something that will not load.
 */
export async function searchMods(opts: {
  query: string;
  gameVersion?: string | undefined;
  loader?: string | undefined;
  limit: number;
  offset: number;
}): Promise<{ hits: ModSearchHit[]; total: number }> {
  const facets: string[][] = [["project_type:mod"]];
  if (opts.loader) {
    facets.push([`categories:${opts.loader}`]);
  }
  if (opts.gameVersion) {
    facets.push([`versions:${opts.gameVersion}`]);
  }

  const data = await modrinthGet<{
    hits: Array<Record<string, any>>;
    total_hits: number;
  }>("/search", {
    query: opts.query,
    facets: JSON.stringify(facets),
    limit: String(opts.limit),
    offset: String(opts.offset),
    index: "relevance",
  });

  return {
    total: data.total_hits ?? 0,
    hits: (data.hits ?? []).map((hit) => ({
      projectId: hit.project_id,
      slug: hit.slug,
      title: hit.title,
      description: hit.description,
      author: hit.author,
      downloads: hit.downloads ?? 0,
      iconUrl: hit.icon_url ?? null,
      categories: hit.categories ?? [],
    })),
  };
}

export async function listProjectVersions(
  projectId: string,
  opts: { gameVersion?: string | undefined; loader?: string | undefined },
): Promise<ModVersion[]> {
  const params: Record<string, string> = {};
  if (opts.loader) {
    params.loaders = JSON.stringify([opts.loader]);
  }
  if (opts.gameVersion) {
    params.game_versions = JSON.stringify([opts.gameVersion]);
  }

  const data = await modrinthGet<Array<Record<string, any>>>(
    `/project/${encodeURIComponent(projectId)}/version`,
    params,
  );

  // Modrinth ne garantit pas l'ordre: on trie du plus recent au plus ancien
  // pour que la premiere entree soit bien la derniere version publiee.
  return (data ?? [])
    .slice()
    .sort(
      (a, b) =>
        Date.parse(b.date_published ?? 0) - Date.parse(a.date_published ?? 0),
    )
    .map((version) => {
      // Le fichier principal porte primary: true; sinon on prend le premier.
      const files = version.files ?? [];
      const file = files.find((f: any) => f.primary) ?? files[0];
      if (!file?.hashes?.sha512) {
        return null;
      }

      return {
        versionId: version.id,
        name: version.name,
        versionNumber: version.version_number,
        gameVersions: version.game_versions ?? [],
        loaders: version.loaders ?? [],
        fileName: file.filename,
        downloadUrl: file.url,
        size: file.size ?? 0,
        sha512: file.hashes.sha512,
        datePublished: version.date_published,
      } satisfies ModVersion;
    })
    .filter((v): v is ModVersion => v !== null);
}

function modsDir(profileId: string): string {
  return path.join(instanceDir(profileId), "mods");
}

/**
 * Install a specific version into the profile's own mods folder, verifying the
 * SHA-512 published by Modrinth before the file is put in place.
 */
export async function installMod(opts: {
  profileId: string;
  projectId: string;
  versionId: string;
}): Promise<InstalledMod> {
  const versions = await listProjectVersions(opts.projectId, {});
  const version = versions.find((v) => v.versionId === opts.versionId);
  if (!version) {
    throw new Error("Version introuvable pour ce mod");
  }

  const dir = modsDir(opts.profileId);
  await fs.promises.mkdir(dir, { recursive: true });

  // Le nom de fichier vient de Modrinth: on le confine au dossier mods.
  const target = resolveInsideRoot(dir, path.basename(version.fileName));

  await downloadVerified(version.downloadUrl, target, {
    algorithm: "sha512",
    value: version.sha512,
  });

  const stats = await fs.promises.stat(target);
  return {
    fileName: path.basename(target),
    size: stats.size,
    installedAt: new Date().toISOString(),
  };
}

export async function listInstalledMods(
  profileId: string,
): Promise<InstalledMod[]> {
  const dir = modsDir(profileId);
  if (!fs.existsSync(dir)) {
    return [];
  }

  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const mods: InstalledMod[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".jar")) {
      continue;
    }
    const stats = await fs.promises.stat(path.join(dir, entry.name));
    mods.push({
      fileName: entry.name,
      size: stats.size,
      installedAt: stats.mtime.toISOString(),
    });
  }

  return mods.sort((a, b) => a.fileName.localeCompare(b.fileName));
}

export async function removeMod(
  profileId: string,
  fileName: string,
): Promise<boolean> {
  const dir = modsDir(profileId);
  const target = resolveInsideRoot(dir, path.basename(fileName));

  if (!fs.existsSync(target)) {
    return false;
  }

  await safeUnlink(target);
  return true;
}

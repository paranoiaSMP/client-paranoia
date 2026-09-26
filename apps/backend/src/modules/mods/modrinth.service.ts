import fs from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";
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

export interface ModDependency {
  projectId: string | null;
  versionId: string | null;
  required: boolean;
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
  dependencies: ModDependency[];
}

export interface InstalledMod {
  fileName: string;
  name?: string | null;
  iconUrl?: string | null;
  size: number;
  installedAt: string;
  enabled: boolean;
}

export interface InstallResult {
  /** Le mod demande. */
  mod: InstalledMod;
  /** Dependances requises posees au passage (Fabric API et consorts). */
  dependencies: InstalledMod[];
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
export type ModContentType = "mod" | "shader" | "resourcepack";

export async function searchMods(opts: {
  query: string;
  gameVersion?: string | undefined;
  loader?: string | undefined;
  limit: number;
  offset?: number;
  projectType?: ModContentType | undefined;
}): Promise<{ hits: ModSearchHit[]; total: number }> {
  const pType = opts.projectType ?? "mod";
  const facets: string[][] = [[`project_type:${pType}`]];
  if (pType === "mod" && opts.loader) {
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
    offset: String(opts.offset ?? 0),
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
        dependencies: (version.dependencies ?? []).map((dep: any) => ({
          projectId: dep.project_id ?? null,
          versionId: dep.version_id ?? null,
          required: dep.dependency_type === "required",
        })),
      } satisfies ModVersion;
    })
    .filter((v): v is ModVersion => v !== null);
}

function contentDir(profileId: string, type: ModContentType = "mod"): string {
  switch (type) {
    case "shader":
      return path.join(instanceDir(profileId), "shaderpacks");
    case "resourcepack":
      return path.join(instanceDir(profileId), "resourcepacks");
    default:
      return path.join(instanceDir(profileId), "mods");
  }
}

async function downloadVersion(
  profileId: string,
  version: ModVersion,
  type: ModContentType = "mod",
): Promise<InstalledMod> {
  const dir = contentDir(profileId, type);
  await fs.promises.mkdir(dir, { recursive: true });

  const target = resolveInsideRoot(dir, path.basename(version.fileName));

  await downloadVerified(version.downloadUrl, target, {
    algorithm: "sha512",
    value: version.sha512,
  });

  const stats = await fs.promises.stat(target);
  return {
    fileName: path.basename(target),
    name: null,
    iconUrl: null,
    size: stats.size,
    installedAt: new Date().toISOString(),
    enabled: true,
  };
}

async function resolveDependencyVersion(
  dependency: ModDependency,
  context: { gameVersion?: string | undefined; loader?: string | undefined },
): Promise<ModVersion | null> {
  if (!dependency.projectId) {
    return null;
  }

  const versions = await listProjectVersions(dependency.projectId, context);
  if (dependency.versionId) {
    const pinned = versions.find((v) => v.versionId === dependency.versionId);
    if (pinned) {
      return pinned;
    }
  }

  return versions[0] ?? null;
}

type ModMetadata = {
  name?: string | undefined;
  iconUrl?: string | undefined;
};

function metaFilePath(profileId: string, type: ModContentType = "mod"): string {
  return path.join(
    instanceDir(profileId),
    `${type === "mod" ? "mods" : type}-metadata.json`,
  );
}

async function loadModsMetadata(
  profileId: string,
  type: ModContentType = "mod",
): Promise<Record<string, ModMetadata>> {
  try {
    const file = metaFilePath(profileId, type);
    if (!fs.existsSync(file)) return {};
    return JSON.parse(await fs.promises.readFile(file, "utf8"));
  } catch {
    return {};
  }
}

async function saveModsMetadata(
  profileId: string,
  data: Record<string, ModMetadata>,
  type: ModContentType = "mod",
) {
  try {
    const file = metaFilePath(profileId, type);
    await fs.promises.writeFile(file, JSON.stringify(data, null, 2), "utf8");
  } catch {}
}

const jarMetaCache = new Map<string, { mtime: number } & ModMetadata>();

function extractJarMetadata(filePath: string): ModMetadata {
  try {
    const zip = new AdmZip(filePath);
    const manifestEntry =
      zip.getEntry("fabric.mod.json") ?? zip.getEntry("quilt.mod.json");
    if (manifestEntry) {
      const meta = JSON.parse(manifestEntry.getData().toString("utf8"));
      const name = typeof meta.name === "string" ? meta.name : undefined;
      let iconPath: string | undefined;
      if (typeof meta.icon === "string") {
        iconPath = meta.icon;
      } else if (meta.icon && typeof meta.icon === "object") {
        iconPath =
          meta.icon["128"] ??
          meta.icon["64"] ??
          meta.icon["32"] ??
          Object.values(meta.icon)[0];
      }
      let iconUrl: string | undefined;
      if (iconPath) {
        const cleanPath = iconPath.startsWith("/") ? iconPath.slice(1) : iconPath;
        const iconEntry = zip.getEntry(cleanPath);
        if (iconEntry) {
          iconUrl = `data:image/png;base64,${iconEntry.getData().toString("base64")}`;
        }
      }
      const result: ModMetadata = {};
      if (name) result.name = name;
      if (iconUrl) result.iconUrl = iconUrl;
      return result;
    }

    const packPng = zip.getEntry("pack.png");
    if (packPng) {
      return {
        iconUrl: `data:image/png;base64,${packPng.getData().toString("base64")}`,
      };
    }
    return {};
  } catch {
    return {};
  }
}

function getJarMetadata(filePath: string, mtime: number): ModMetadata {
  const cached = jarMetaCache.get(filePath);
  if (cached && cached.mtime === mtime) {
    return cached;
  }
  const meta = extractJarMetadata(filePath);
  jarMetaCache.set(filePath, { mtime, ...meta });
  return meta;
}

export async function installMod(opts: {
  profileId: string;
  projectId: string;
  versionId: string;
  gameVersion?: string | undefined;
  loader?: string | undefined;
  projectType?: ModContentType | undefined;
}): Promise<InstallResult> {
  const type = opts.projectType ?? "mod";
  const versions = await listProjectVersions(opts.projectId, {});
  const version = versions.find((v) => v.versionId === opts.versionId);
  if (!version) {
    throw new Error("Version introuvable");
  }

  const context = { gameVersion: opts.gameVersion, loader: opts.loader };
  const mod = await downloadVersion(opts.profileId, version, type);

  const metadata = await loadModsMetadata(opts.profileId, type);
  const project = await modrinthGet<any>(
    `/project/${encodeURIComponent(opts.projectId)}`,
    {},
  ).catch(() => null);

  if (project) {
    const entry: ModMetadata = {};
    if (project.title) entry.name = project.title;
    if (project.icon_url) entry.iconUrl = project.icon_url;
    metadata[mod.fileName] = entry;
    mod.name = project.title ?? null;
    mod.iconUrl = project.icon_url ?? null;
  }

  const installed: InstalledMod[] = [];

  if (type === "mod") {
    const seen = new Set<string>([opts.projectId]);
    const queue: ModDependency[] = version.dependencies.filter((d) => d.required);

    while (queue.length > 0) {
      const dependency = queue.shift()!;
      if (!dependency.projectId || seen.has(dependency.projectId)) {
        continue;
      }
      seen.add(dependency.projectId);

      try {
        const resolved = await resolveDependencyVersion(dependency, context);
        if (!resolved) continue;

        const installedDep = await downloadVersion(opts.profileId, resolved, "mod");
        if (dependency.projectId) {
          const depProj = await modrinthGet<any>(
            `/project/${encodeURIComponent(dependency.projectId)}`,
            {},
          ).catch(() => null);
          if (depProj) {
            const entry: ModMetadata = {};
            if (depProj.title) entry.name = depProj.title;
            if (depProj.icon_url) entry.iconUrl = depProj.icon_url;
            metadata[installedDep.fileName] = entry;
            installedDep.name = depProj.title ?? null;
            installedDep.iconUrl = depProj.icon_url ?? null;
          }
        }

        installed.push(installedDep);
        queue.push(...resolved.dependencies.filter((d) => d.required));
      } catch (err) {
        console.warn(
          `[mods] dependance ${dependency.projectId} non installee:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  }

  await saveModsMetadata(opts.profileId, metadata, type);

  return { mod, dependencies: installed };
}

export async function listInstalledMods(
  profileId: string,
  type: ModContentType = "mod",
): Promise<InstalledMod[]> {
  const dir = contentDir(profileId, type);
  if (!fs.existsSync(dir)) {
    return [];
  }

  const metadata = await loadModsMetadata(profileId, type);
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  const mods: InstalledMod[] = [];

  const isValidFile = (name: string) => {
    if (type === "mod") {
      return name.endsWith(".jar") || name.endsWith(".jar.disabled");
    }
    return (
      name.endsWith(".zip") ||
      name.endsWith(".zip.disabled") ||
      name.endsWith(".jar") ||
      name.endsWith(".jar.disabled")
    );
  };

  for (const entry of entries) {
    if (!entry.isFile() || !isValidFile(entry.name)) {
      continue;
    }
    const fullPath = path.join(dir, entry.name);
    const stats = await fs.promises.stat(fullPath);
    const meta = metadata[entry.name] ?? getJarMetadata(fullPath, stats.mtimeMs);

    mods.push({
      fileName: entry.name,
      name: meta?.name ?? null,
      iconUrl: meta?.iconUrl ?? null,
      size: stats.size,
      installedAt: stats.mtime.toISOString(),
      enabled: !entry.name.endsWith(".disabled"),
    });
  }

  return mods.sort((a, b) => (a.name || a.fileName).localeCompare(b.name || b.fileName));
}

export async function toggleMod(
  profileId: string,
  fileName: string,
  type: ModContentType = "mod",
): Promise<InstalledMod | null> {
  const dir = contentDir(profileId, type);
  const cleanName = path.basename(fileName);
  const source = resolveInsideRoot(dir, cleanName);

  if (!fs.existsSync(source)) {
    return null;
  }

  const isCurrentlyDisabled = cleanName.endsWith(".disabled");
  const newName = isCurrentlyDisabled
    ? cleanName.replace(/\.disabled$/, "")
    : `${cleanName}.disabled`;
  const target = resolveInsideRoot(dir, newName);

  await fs.promises.rename(source, target);

  const metadata = await loadModsMetadata(profileId, type);
  if (metadata[cleanName]) {
    metadata[newName] = metadata[cleanName];
    delete metadata[cleanName];
    await saveModsMetadata(profileId, metadata, type);
  }

  const stats = await fs.promises.stat(target);
  const meta = metadata[newName] ?? getJarMetadata(target, stats.mtimeMs);

  return {
    fileName: newName,
    name: meta?.name ?? null,
    iconUrl: meta?.iconUrl ?? null,
    size: stats.size,
    installedAt: stats.mtime.toISOString(),
    enabled: !newName.endsWith(".disabled"),
  };
}

export async function removeMod(
  profileId: string,
  fileName: string,
  type: ModContentType = "mod",
): Promise<boolean> {
  const dir = contentDir(profileId, type);
  const target = resolveInsideRoot(dir, path.basename(fileName));

  if (!fs.existsSync(target)) {
    return false;
  }

  await safeUnlink(target);
  const metadata = await loadModsMetadata(profileId, type);
  if (metadata[path.basename(fileName)]) {
    delete metadata[path.basename(fileName)];
    await saveModsMetadata(profileId, metadata, type);
  }
  return true;
}

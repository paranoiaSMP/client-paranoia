import fs from "node:fs";
import path from "node:path";
import { paranoiaDataDir } from "../launcher/paths.js";

const VERSION_MANIFEST_URL =
  process.env.MINECRAFT_VERSION_MANIFEST_URL ??
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

const CACHE_TTL_MS = 60 * 60 * 1000;

interface ManifestVersion {
  id: string;
  type: string;
  releaseTime: string;
}

let cache: { versions: string[]; fetchedAt: number } | null = null;

/**
 * Last list successfully fetched, kept on disk.
 *
 * Without it, a player who has been offline since install falls back to the
 * versions frozen in the bundled config, which age with every Minecraft
 * release. With it, the newest list ever seen survives restarts.
 */
const CACHE_FILE = () => path.join(paranoiaDataDir(), "minecraft-versions.json");

function readDiskCache(): string[] | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE(), "utf-8"));
    return Array.isArray(parsed?.versions) && parsed.versions.length > 0
      ? (parsed.versions as string[])
      : null;
  } catch {
    return null;
  }
}

function writeDiskCache(versions: string[]): void {
  try {
    const file = CACHE_FILE();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({ versions, updatedAt: new Date().toISOString() }),
      "utf-8",
    );
  } catch (err) {
    // Un cache non ecrit n'empeche rien: on repartira du reseau.
    console.warn("[catalog] cache des versions non ecrit:", err);
  }
}

/**
 * Live release list from Mojang, newest first.
 *
 * The supported versions used to be hardcoded in the remote config, so every
 * new Minecraft release meant shipping a new launcher. Snapshots are filtered
 * out: they are not what a player picks to play on a server.
 */
export async function fetchMinecraftReleases(): Promise<string[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.versions;
  }

  const response = await fetch(VERSION_MANIFEST_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`manifeste Mojang indisponible (${response.status})`);
  }

  const data = (await response.json()) as { versions?: ManifestVersion[] };
  const versions = (data.versions ?? [])
    .filter((version) => version.type === "release")
    .sort(
      (a, b) =>
        Date.parse(b.releaseTime) - Date.parse(a.releaseTime),
    )
    .map((version) => version.id);

  if (versions.length === 0) {
    throw new Error("manifeste Mojang vide");
  }

  cache = { versions, fetchedAt: Date.now() };
  writeDiskCache(versions);
  return versions;
}

/**
 * Same list, but never throws: falls back to whatever the bundled config
 * declares so the launcher still works offline.
 */
export async function minecraftReleasesOrFallback(
  fallback: string[],
): Promise<string[]> {
  try {
    return await fetchMinecraftReleases();
  } catch (err) {
    console.warn(
      "[catalog] liste des versions Mojang indisponible:",
      err instanceof Error ? err.message : err,
    );

    // La derniere liste connue vaut mieux que celle figee a la compilation.
    return readDiskCache() ?? fallback;
  }
}

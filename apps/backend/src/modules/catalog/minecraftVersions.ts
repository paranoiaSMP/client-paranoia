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
      "[catalog] liste des versions Mojang indisponible, repli sur la config embarquee:",
      err instanceof Error ? err.message : err,
    );
    return fallback;
  }
}

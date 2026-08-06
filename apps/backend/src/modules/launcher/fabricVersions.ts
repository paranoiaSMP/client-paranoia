const FABRIC_META =
  process.env.FABRIC_META_BASE_URL ?? "https://meta.fabricmc.net/v2";

const CACHE_TTL_MS = 60 * 60 * 1000;

interface LoaderEntry {
  loader?: { version?: string; stable?: boolean };
}

const cache = new Map<string, { version: string | null; fetchedAt: number }>();

/**
 * Latest stable Fabric loader for a given Minecraft version, or null when
 * Fabric does not support it yet.
 *
 * The loader version used to come from the remote catalog, where no entry ever
 * filled it in — so Fabric was never installed and every mod dropped in `mods`
 * was silently ignored by a vanilla game.
 */
export async function latestStableLoader(
  minecraftVersion: string,
): Promise<string | null> {
  const cached = cache.get(minecraftVersion);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.version;
  }

  const url = `${FABRIC_META}/versions/loader/${encodeURIComponent(minecraftVersion)}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    throw new Error(
      `Fabric est injoignable: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!response.ok) {
    throw new Error(`Fabric a repondu ${response.status}`);
  }

  const entries = (await response.json()) as LoaderEntry[];
  const stable = entries.find((entry) => entry.loader?.stable)?.loader?.version;
  // Faute de version stable, on accepte la plus recente proposee: une version
  // de Minecraft toute juste sortie n'a parfois que des loaders en beta.
  const version = stable ?? entries[0]?.loader?.version ?? null;

  cache.set(minecraftVersion, { version, fetchedAt: Date.now() });
  return version;
}

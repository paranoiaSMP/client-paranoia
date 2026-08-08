const VERSION_MANIFEST_URL =
  process.env.MINECRAFT_VERSION_MANIFEST_URL ??
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

const cache = new Map<string, number>();

/**
 * Fallback when Mojang cannot be reached. Mirrors the majors Mojang has
 * required historically; only used offline or if the metadata is missing.
 */
function guessFromVersion(minecraftVersion: string): number {
  const match = /^1\.(\d+)(?:\.(\d+))?/.exec(minecraftVersion);
  if (!match) {
    return 21;
  }

  const minor = Number(match[1]);
  const patch = Number(match[2] ?? 0);

  if (minor <= 16) return 8;
  if (minor <= 19) return 17;
  if (minor === 20 && patch < 5) return 17;
  return 21;
}

/**
 * Java major required by a Minecraft version, read from Mojang's own metadata.
 *
 * Every version's JSON carries `javaVersion.majorVersion`, so a future release
 * asking for Java 25 or 27 is handled without touching this code.
 */
export async function requiredJavaMajor(
  minecraftVersion: string,
): Promise<number> {
  const cached = cache.get(minecraftVersion);
  if (cached !== undefined) {
    return cached;
  }

  try {
    const manifestRes = await fetch(VERSION_MANIFEST_URL, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!manifestRes.ok) {
      throw new Error(`manifeste Mojang: ${manifestRes.status}`);
    }

    const manifest = (await manifestRes.json()) as {
      versions?: Array<{ id: string; url: string }>;
    };
    const entry = manifest.versions?.find((v) => v.id === minecraftVersion);
    if (!entry?.url) {
      throw new Error(`version ${minecraftVersion} absente du manifeste`);
    }

    const detailRes = await fetch(entry.url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!detailRes.ok) {
      throw new Error(`metadonnees de version: ${detailRes.status}`);
    }

    const detail = (await detailRes.json()) as {
      javaVersion?: { majorVersion?: number };
    };
    const major = detail.javaVersion?.majorVersion;
    if (typeof major !== "number") {
      throw new Error("javaVersion absent des metadonnees");
    }

    cache.set(minecraftVersion, major);
    return major;
  } catch (err) {
    const fallback = guessFromVersion(minecraftVersion);
    console.warn(
      `[launcher] version Java pour ${minecraftVersion} indeterminee ` +
        `(${err instanceof Error ? err.message : err}), repli sur Java ${fallback}`,
    );
    return fallback;
  }
}

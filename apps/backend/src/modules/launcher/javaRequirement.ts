const VERSION_MANIFEST_URL =
  process.env.MINECRAFT_VERSION_MANIFEST_URL ??
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

const cache = new Map<string, number>();

/**
 * Fallback when Mojang cannot be reached. Mirrors the majors Mojang has
 * required historically; only used offline or if the metadata is missing.
 */
function guessFromVersion(minecraftVersion: string): number {
  // Gère les anciennes versions (1.x.y) et les nouvelles (ex: 26.1 depuis le Game drop de 2026)
  const oldMatch = /^1\.(\d+)(?:\.(\d+))?/.exec(minecraftVersion);
  const newMatch = /^(\d+)(?:\.(\d+))?/.exec(minecraftVersion);
  
  let featureVersion = 0;
  let patchVersion = 0;

  if (oldMatch) {
    featureVersion = Number(oldMatch[1]);
    patchVersion = Number(oldMatch[2] ?? 0);
  } else if (newMatch) {
    featureVersion = Number(newMatch[1]);
    patchVersion = Number(newMatch[2] ?? 0);
  } else {
    return 25; // Par défaut pour les versions très récentes ou inconnues
  }

  if (featureVersion <= 16) return 8;
  if (featureVersion <= 19) return 17;
  if (featureVersion === 20 && patchVersion < 5) return 17;
  if (featureVersion === 20 || featureVersion === 21) return 21;
  return 25; // Pour 1.22+ ou 26+ (Game drops), Java 25 (class version 69.0)
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

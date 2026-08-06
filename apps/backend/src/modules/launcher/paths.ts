import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

/**
 * Per-OS locations. Everything used to assume `%APPDATA%` on Windows, which
 * silently produced a bogus `~/AppData/Roaming` folder on macOS and Linux.
 */

export function paranoiaDataDir(): string {
  const home = os.homedir();

  switch (process.platform) {
    case "win32":
      return path.join(
        process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
        ".paranoia-client",
      );
    case "darwin":
      return path.join(home, "Library", "Application Support", "paranoia-client");
    default:
      return path.join(
        process.env.XDG_DATA_HOME ?? path.join(home, ".local", "share"),
        "paranoia-client",
      );
  }
}

/**
 * Per-profile game folder: mods, saves, config, resource packs, options.txt.
 * Versions, libraries, assets and the Java runtime stay in the shared root —
 * duplicating those per profile would cost gigabytes for nothing.
 */
export function instanceDir(profileId: string): string {
  // profileId vient d'un randomUUID cote store, mais il transite par l'API:
  // on refuse tout ce qui n'est pas un identifiant simple pour qu'il ne puisse
  // pas servir a remonter hors du dossier des instances.
  if (!/^[A-Za-z0-9._-]+$/.test(profileId)) {
    throw new Error(`Identifiant de profil invalide: ${profileId}`);
  }

  return path.join(paranoiaDataDir(), "instances", profileId);
}

/** Folders a player expects to find, even before installing anything. */
export const INSTANCE_SUBFOLDERS = [
  "mods",
  "resourcepacks",
  "shaderpacks",
  "config",
  "saves",
  "screenshots",
] as const;

/**
 * Create the instance layout up front. They used to appear only once a mod was
 * installed or the game had run once, so a fresh profile had no `mods` folder
 * to drop a jar into.
 */
export async function ensureInstanceLayout(profileId: string): Promise<string> {
  const dir = instanceDir(profileId);
  await fs.mkdir(dir, { recursive: true });
  await Promise.all(
    INSTANCE_SUBFOLDERS.map((name) =>
      fs.mkdir(path.join(dir, name), { recursive: true }),
    ),
  );
  return dir;
}

/** Where the official Minecraft launcher keeps its `.minecraft` folder. */
export function vanillaMinecraftDir(): string {
  const home = os.homedir();

  switch (process.platform) {
    case "win32":
      return path.join(
        process.env.APPDATA ?? path.join(home, "AppData", "Roaming"),
        ".minecraft",
      );
    case "darwin":
      return path.join(home, "Library", "Application Support", "minecraft");
    default:
      return path.join(home, ".minecraft");
  }
}

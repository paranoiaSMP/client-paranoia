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

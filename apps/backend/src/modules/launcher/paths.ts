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

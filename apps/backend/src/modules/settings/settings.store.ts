import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { paranoiaDataDir } from "../launcher/paths.js";

/**
 * Launcher-wide settings. They used to live only in React state: changing a
 * value and switching tab lost it, and none of them ever reached the game.
 */
export const settingsSchema = z.object({
  ramMinMb: z.number().int().min(512).max(65536).default(2048),
  ramMaxMb: z.number().int().min(512).max(65536).default(4096),
  /** Chemin Java impose par le joueur; vide = runtime telecharge automatiquement. */
  javaPath: z.string().max(512).default(""),
  jvmArgs: z.string().max(1024).default("-XX:+UseG1GC"),
  width: z.number().int().min(320).max(7680).default(1280),
  height: z.number().int().min(240).max(4320).default(720),
  fullscreen: z.boolean().default(false),
  keepLauncherOpen: z.boolean().default(false),
  autoConnect: z.boolean().default(true),
  language: z.enum(["fr", "en"]).default("fr"),
});

export type LauncherSettings = z.infer<typeof settingsSchema>;

const DB_PATH = join(paranoiaDataDir(), "settings.json");

export function readSettings(): LauncherSettings {
  try {
    const raw = JSON.parse(readFileSync(DB_PATH, "utf-8"));
    // parse() applique les valeurs par defaut pour toute cle absente, ce qui
    // rend la lecture tolerante a un fichier ecrit par une version anterieure.
    return settingsSchema.parse(raw);
  } catch {
    return settingsSchema.parse({});
  }
}

export function writeSettings(input: unknown): LauncherSettings {
  const settings = settingsSchema.parse(input);

  // Une RAM maximale sous la minimale ferait refuser le demarrage a la JVM.
  if (settings.ramMaxMb < settings.ramMinMb) {
    settings.ramMaxMb = settings.ramMinMb;
  }

  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(DB_PATH, JSON.stringify(settings, null, 2), "utf-8");

  return settings;
}

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { paranoiaDataDir } from "../launcher/paths.js";

/**
 * Launcher-wide settings. They used to live only in React state: changing a
 * value and switching tab lost it, and none of them ever reached the game.
 */
/**
 * Les valeurs que ce champ a portees comme defaut, au fil des versions.
 *
 * <p>Le reglage des drapeaux JVM a demenage dans
 * {@code launcher/jvmFlags.ts}: c'est le launcher qui les pose desormais, et il
 * les choisit selon la version de Java que la version de Minecraft impose -- 21
 * pour les 1.21.x, 25 pour les 26.x. Un champ unique et global ne pouvait pas
 * porter un reglage qui depend du profil.
 *
 * <p>Ce champ redevient donc ce qu'il aurait toujours du etre: <strong>ce que le
 * joueur ajoute</strong>, et rien d'autre. Vide par defaut.
 *
 * <p>D'ou cette liste. Un joueur dont le fichier contient exactement l'un de ces
 * defauts ne l'a jamais saisi: c'est nous qui l'y avions mis. On le vide, sinon
 * il enverrait les memes drapeaux deux fois -- une fois par le launcher, une fois
 * par « son » reglage -- et il resterait sourd a toute evolution. Celui qui a
 * ecrit les siens les garde, ce qui est tout l'interet de comparer a la valeur
 * exacte plutot que d'ecraser.
 */
const DEFAUTS_HISTORIQUES = [
  // Ne servait a rien: G1 est deja le ramasse-miettes par defaut des JVM
  // modernes, donc ce drapeau seul ne changeait strictement rien.
  "-XX:+UseG1GC",

  // Le jeu de six drapeaux qui a suivi. Ils ne disparaissent pas: ils sont
  // desormais poses par jvmFlags.ts, avec quatre de plus.
  [
    "-XX:+UseG1GC",
    "-XX:+ParallelRefProcEnabled",
    "-XX:+DisableExplicitGC",
    "-XX:+PerfDisableSharedMem",
    "-XX:MaxGCPauseMillis=50",
    "-XX:G1HeapRegionSize=8M",
  ].join(" "),
];

/**
 * Reconnait un defaut historique, aux espaces pres.
 *
 * <p>Comparer les chaines telles quelles ne suffit pas: le champ passe par une
 * interface ou une saisie, et un espace en trop suffirait a faire passer pour un
 * choix du joueur une valeur qu'il n'a jamais tapee.
 */
export function estUnAncienDefaut(valeur: string): boolean {
  const normalise = (texte: string) => texte.trim().split(/\s+/).join(" ");
  const cible = normalise(valeur);
  return DEFAUTS_HISTORIQUES.some((ancien) => normalise(ancien) === cible);
}

export const settingsSchema = z.object({
  ramMinMb: z.number().int().min(512).max(65536).default(2048),
  ramMaxMb: z.number().int().min(512).max(65536).default(4096),
  /** Chemin Java impose par le joueur; vide = runtime telecharge automatiquement. */
  javaPath: z.string().max(512).default(""),
  /** Ce que le joueur ajoute. Le reglage du launcher vit dans jvmFlags.ts. */
  jvmArgs: z.string().max(1024).default(""),
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
    const settings = settingsSchema.parse(raw);

    // Le joueur qui n'a jamais touche a ce champ le retrouve vide: les drapeaux
    // viennent maintenant du launcher, qui les choisit selon la version de Java.
    // Changer la valeur par defaut ne suffit pas -- son fichier contient deja
    // l'ancienne -- et les laisser enverrait les memes drapeaux deux fois.
    // Celui qui a saisi les siens les conserve.
    if (estUnAncienDefaut(settings.jvmArgs)) {
      settings.jvmArgs = "";
    }

    return settings;
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

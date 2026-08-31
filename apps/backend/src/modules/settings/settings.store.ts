import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { z } from "zod";
import { paranoiaDataDir } from "../launcher/paths.js";

/**
 * Launcher-wide settings. They used to live only in React state: changing a
 * value and switching tab lost it, and none of them ever reached the game.
 */
/**
 * Ce que valait le reglage avant qu'on le regle vraiment.
 *
 * <p>Garde pour reconnaitre le joueur qui n'y a jamais touche: lui seul voit
 * ses arguments remplaces. Celui qui a saisi les siens les conserve.
 */
const LEGACY_JVM_ARGS = "-XX:+UseG1GC";

/**
 * Arguments JVM par defaut.
 *
 * L'ancienne valeur ne servait a rien: G1 est deja le ramasse-miettes par
 * defaut sur les JVM modernes, donc le seul drapeau present ne changeait
 * strictement rien. Ce qui compte, ce sont les reglages qui suivent.
 *
 * - `DisableExplicitGC` est le plus utile de tous. Certaines bibliotheques
 *   appellent `System.gc()`, ce qui declenche un ramassage complet qui arrete
 *   le jeu net -- le blocage d'une demi-seconde en pleine partie, sans cause
 *   visible. Ce drapeau rend ces appels sans effet.
 * - `PerfDisableSharedMem` empeche la JVM d'ecrire son fichier de statistiques
 *   sur le disque. Quand le disque hoquette, cette ecriture bloque la machine
 *   virtuelle entiere; c'est une cause connue de micro-freezes inexplicables.
 * - `MaxGCPauseMillis=50` remplace la cible de 200 ms par defaut. A soixante
 *   images par seconde, une image dure seize millisecondes: une pause de
 *   200 ms en fait tomber douze d'affilee. On echange un peu de debit contre
 *   des pauses plus courtes, ce qui est exactement le compromis d'un jeu.
 * - `G1HeapRegionSize=8M`: avec quatre gigaoctets, G1 choisit des regions de
 *   deux megaoctets, et tout objet depassant un megaoctet devient « enorme »
 *   et n'est ramasse qu'aux collectes completes. Les tableaux de sections de
 *   terrain franchissent ce seuil. Des regions de huit megaoctets le repoussent.
 * - `ParallelRefProcEnabled` traite en parallele les references faibles, dont
 *   le jeu fait un usage massif pour ses textures et ses morceaux de terrain.
 *
 * Aucun de ces drapeaux n'est experimental: tous existent en production dans
 * HotSpot et ne demandent pas de deverrouillage. C'est deliberé -- un drapeau
 * inconnu fait refuser le demarrage a la JVM, et le jeu ne se lancerait plus.
 */
const DEFAULT_JVM_ARGS = [
  "-XX:+UseG1GC",
  "-XX:+ParallelRefProcEnabled",
  "-XX:+DisableExplicitGC",
  "-XX:+PerfDisableSharedMem",
  "-XX:MaxGCPauseMillis=50",
  "-XX:G1HeapRegionSize=8M",
].join(" ");

export const settingsSchema = z.object({
  ramMinMb: z.number().int().min(512).max(65536).default(2048),
  ramMaxMb: z.number().int().min(512).max(65536).default(4096),
  /** Chemin Java impose par le joueur; vide = runtime telecharge automatiquement. */
  javaPath: z.string().max(512).default(""),
  jvmArgs: z.string().max(1024).default(DEFAULT_JVM_ARGS),
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

    // Le joueur qui n'a jamais touche a ce champ herite des nouveaux
    // arguments. Changer la valeur par defaut ne suffit pas: son fichier
    // contient deja l'ancienne, et il garderait indefiniment un reglage qui ne
    // sert a rien. En revanche celui qui a saisi les siens les conserve --
    // c'est tout l'interet de comparer a l'ancienne valeur exacte plutot que
    // d'ecraser.
    if (settings.jvmArgs.trim() === LEGACY_JVM_ARGS) {
      settings.jvmArgs = DEFAULT_JVM_ARGS;
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

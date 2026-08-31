import fs from "node:fs";
import path from "node:path";
import { installMod, listProjectVersions } from "../mods/modrinth.service.js";

/**
 * Pose les mods d'optimisation dans une instance neuve.
 *
 * <p>Le client Paranoia optimise ce qu'un mod de sa taille peut atteindre: les
 * entites, les blocs animes, les particules, ses propres allocations. Il ne
 * touche pas au rendu du terrain, qui est de loin le poste le plus lourd du
 * jeu -- et le reecrire serait plusieurs annees de travail pour arriver, au
 * mieux, la ou Sodium est deja.
 *
 * <p>On installe donc Sodium plutot que de le refaire, et trois autres qui
 * couvrent ce que Sodium ne couvre pas. Aucun des quatre ne se voit a l'ecran,
 * aucun ne touche au gameplay, et aucun ne recouvre le travail du client: Sodium
 * s'occupe du terrain, le client s'occupe des entites.
 *
 * <p><strong>A la creation du profil, et uniquement la.</strong> Un joueur qui
 * retire Sodium a une raison de le faire -- un pilote graphique capricieux, un
 * shader incompatible, une preference. Le lui remettre a chaque lancement serait
 * lui reprendre une decision qu'il a prise exprès. Le fichier temoin garde la
 * trace de ce qu'on a pose pour ne jamais le reposer.
 */

interface PerformanceMod {
  /** Identifiant ou slug Modrinth. */
  readonly projectId: string;
  readonly label: string;
  /** Ce qu'il apporte, pour le journal. */
  readonly role: string;
  /**
   * Reconnait une version deja presente, quelle qu'elle soit.
   *
   * <p>Indispensable et pas seulement prudent: un profil peut naitre en copiant
   * l'instance d'un autre launcher, laquelle contient souvent deja Sodium. En
   * poser un second exemplaire ne ferait pas doublon sans consequence -- Fabric
   * refuse de demarrer quand deux versions du meme mod sont dans le dossier, et
   * le jeu ne se lancerait plus du tout.
   *
   * <p>Le motif ne suit pas toujours le slug: FerriteCore s'appelle
   * « ferrite-core » chez Modrinth et « ferritecore » dans son fichier.
   */
  readonly fileName: RegExp;
}

const PERFORMANCE_MODS: readonly PerformanceMod[] = [
  {
    projectId: "sodium",
    label: "Sodium",
    role: "rendu du terrain",
    fileName: /^sodium[-_]/i,
  },
  {
    projectId: "lithium",
    label: "Lithium",
    role: "logique de jeu",
    fileName: /^lithium[-_]/i,
  },
  {
    projectId: "ferrite-core",
    label: "FerriteCore",
    role: "empreinte memoire",
    fileName: /^ferrite[-_]?core[-_]/i,
  },
  {
    projectId: "modernfix",
    label: "ModernFix",
    role: "demarrage et memoire",
    fileName: /^modernfix[-_]/i,
  },
];

/**
 * Trace de ce que le launcher a installe de lui-meme.
 *
 * <p>Sans elle on ne saurait pas distinguer « pas encore pose » de « pose puis
 * retire par le joueur », et la seconde situation merite qu'on n'y revienne pas.
 */
const MARKER_FILE = ".paranoia-performance-mods.json";

function markerPath(gameDir: string): string {
  return path.join(gameDir, MARKER_FILE);
}

function readMarker(gameDir: string): Set<string> {
  try {
    const raw = JSON.parse(fs.readFileSync(markerPath(gameDir), "utf-8"));
    return new Set(Array.isArray(raw?.installed) ? raw.installed : []);
  } catch {
    // Fichier absent ou abime: on repart de zero, ce qui au pire refait une
    // installation deja faite -- l'empreinte sur le disque est la meme.
    return new Set();
  }
}

async function writeMarker(gameDir: string, installed: Set<string>): Promise<void> {
  try {
    await fs.promises.writeFile(
      markerPath(gameDir),
      JSON.stringify({ installed: [...installed] }, null, 2),
      "utf-8",
    );
  } catch (err) {
    // Le temoin n'est qu'un confort: son echec ne doit pas remonter.
    console.warn("[Perf] temoin non ecrit:", err instanceof Error ? err.message : err);
  }
}

/**
 * Installe ce qui manque, sans jamais faire echouer l'appelant.
 *
 * <p>Chaque mod est traite pour lui-meme: Modrinth injoignable, version de
 * Minecraft trop recente pour que Sodium ait publie, projet renomme -- rien de
 * tout cela ne doit empecher les autres de s'installer, ni la creation du profil
 * d'aboutir. Un profil sans Sodium reste un profil qui se lance.
 */
export async function ensurePerformanceMods(
  profileId: string,
  gameDir: string,
  minecraftVersion: string,
): Promise<void> {
  const modsDir = path.join(gameDir, "mods");
  await fs.promises.mkdir(modsDir, { recursive: true });

  const installed = readMarker(gameDir);

  // Ce que le dossier contient deja, y compris ce qui vient d'un autre
  // launcher: c'est le disque qui tranche, pas notre temoin.
  let present: string[];
  try {
    present = await fs.promises.readdir(modsDir);
  } catch {
    present = [];
  }

  let posed = 0;

  for (const mod of PERFORMANCE_MODS) {
    if (installed.has(mod.projectId)) {
      continue;
    }

    if (present.some((name) => name.endsWith(".jar") && mod.fileName.test(name))) {
      // Deja la, dans une version qu'on n'a pas choisie. On la laisse: elle
      // fonctionne, et deux exemplaires empecheraient le jeu de demarrer.
      console.log(`[Perf] ${mod.label} deja present, laisse tel quel`);
      installed.add(mod.projectId);
      posed += 1;
      continue;
    }

    try {
      const versions = await listProjectVersions(mod.projectId, {
        gameVersion: minecraftVersion,
        loader: "fabric",
      });

      // listProjectVersions rend la plus recente en tete, deja filtree sur la
      // version du jeu et sur Fabric.
      const latest = versions[0];
      if (!latest) {
        console.warn(
          `[Perf] ${mod.label} n'a pas encore de version pour Minecraft ${minecraftVersion}`,
        );
        continue;
      }

      await installMod({
        profileId,
        projectId: mod.projectId,
        versionId: latest.versionId,
        gameVersion: minecraftVersion,
        loader: "fabric",
      });

      // Marque apres coup seulement: un echec doit pouvoir etre retente.
      installed.add(mod.projectId);
      posed += 1;
      console.log(`[Perf] ${mod.label} installe (${mod.role})`);
    } catch (err) {
      console.warn(
        `[Perf] ${mod.label} non installe:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  if (posed > 0) {
    await writeMarker(gameDir, installed);
  }
}

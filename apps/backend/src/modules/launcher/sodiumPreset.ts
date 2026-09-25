import fs from "node:fs";
import path from "node:path";
import { logger } from "../../logger.js";

/**
 * Regle Sodium, que le launcher installait puis laissait aux valeurs d'usine.
 *
 * <p>Installer un mod de performance et ne pas le configurer, c'est prendre la
 * moitie du gain. Sodium a ses propres options, dans son propre fichier, et
 * elles sont prudentes expres -- il ne sait pas sur quelle machine il tourne.
 *
 * <h2>Pourquoi on modifie au lieu d'ecrire</h2>
 *
 * <p>Ce module ne cree jamais le fichier: il ne touche que celui que Sodium a
 * deja ecrit. Ce n'est pas de la prudence de principe.
 *
 * <p>La forme du fichier a ete lue dans le jar par la CI, pas devinee -- les
 * cles sont en camelCase, la ou tout guide les ecrit en snake_case. Mais lire
 * les noms ne suffit pas: Sodium deserialise avec GSON, et GSON n'execute les
 * initialiseurs de champs que s'il trouve un constructeur sans argument. Sinon
 * il alloue l'objet sans l'initialiser, et une section absente du JSON arrive a
 * {@code null} -- le jeu planterait au demarrage, chez tout le monde, a cause
 * d'un fichier que nous aurions ecrit.
 *
 * <p>Tant que cette question n'est pas tranchee par la sonde, partir du fichier
 * de Sodium la rend sans objet: toutes les sections y sont deja.
 *
 * <p><strong>Consequence a connaitre:</strong> le fichier n'existe qu'apres un
 * premier lancement. Le reglage s'applique donc au deuxieme. Le temoin n'est
 * ecrit que lorsqu'on a vraiment modifie quelque chose, precisement pour que le
 * premier lancement ne consomme pas l'unique tentative.
 *
 * <h2>Ce qu'on regle, et ce qu'on ne regle pas</h2>
 *
 * <p>La contrainte est la meme que pour les reglages video: l'essentiel des
 * joueurs font du PvP, et une optimisation qui retire de l'information fait
 * perdre le combat qu'elle accelere. Deux valeurs seulement passent ce filtre,
 * et l'une des deux ne gagne meme pas d'images -- elle enleve de la latence.
 *
 * <p>Ecartes volontairement, et il faut une raison pour les remettre:
 *
 * <ul>
 *   <li>{@code chunkBuildDeferMode}: retarde l'apparition des blocs poses ou
 *       casses. En PvP le retour immediat d'un bloc pose est tout ce qui compte.
 *   <li>{@code chunkBuilderThreads}: la valeur automatique connait la machine,
 *       nous non.
 *   <li>{@code useNoErrorGLContext}: gagne un peu en supprimant les controles du
 *       pilote, et se paie par un ecran noir sur les pilotes capricieux.
 *   <li>{@code leavesQuality} et {@code weatherQuality}: changent ce que le
 *       joueur voit. Un feuillage plein peut cacher quelqu'un.
 * </ul>
 */

/** Ce que Sodium appelle son fichier, aux deux endroits ou il peut etre. */
const EMPLACEMENTS = [
  path.join("config", "sodium-options.json"),
  "sodium-options.json",
];

const MARKER_FILE = ".paranoia-sodium.json";

/** Une valeur a poser, et l'endroit exact ou elle vit dans le fichier. */
interface Reglage {
  readonly section: string;
  readonly cle: string;
  readonly valeur: number | boolean;
  readonly pourquoi: string;
}

const REGLAGES: readonly Reglage[] = [
  {
    section: "advanced",
    cle: "cpuRenderAheadLimit",
    valeur: 1,
    // Le nombre d'images que le processeur a le droit de preparer en avance sur
    // la carte graphique. Chacune est une image d'ecart entre le clic et ce qui
    // s'affiche: c'est de la latence d'entree, exactement comme la
    // synchronisation verticale qu'on coupe deja. Le defaut de Sodium en
    // autorise trois.
    pourquoi: "latence d'entree",
  },
  {
    section: "quality",
    cle: "enableVignette",
    valeur: false,
    // L'assombrissement des bords de l'ecran. Le couper ne retire aucune
    // information -- c'est un effet pose par-dessus l'image, pas du contenu --
    // et rend les bords lisibles, la ou arrive ce qu'on ne regarde pas.
    pourquoi: "visibilite des bords",
  },
];

function markerPath(gameDir: string): string {
  return path.join(gameDir, MARKER_FILE);
}

function trouveFichier(gameDir: string): string | null {
  for (const relatif of EMPLACEMENTS) {
    const complet = path.join(gameDir, relatif);
    if (fs.existsSync(complet)) {
      return complet;
    }
  }
  return null;
}

/**
 * Pose les reglages, une seule fois, sans jamais faire echouer l'appelant.
 *
 * <p>Comme pour les reglages video: une fois que le joueur y a touche, ils lui
 * appartiennent. Le temoin est la pour ca.
 */
export async function applySodiumPreset(gameDir: string): Promise<void> {
  if (fs.existsSync(markerPath(gameDir))) {
    return;
  }

  const fichier = trouveFichier(gameDir);
  if (!fichier) {
    // Sodium ne l'ecrit qu'au premier demarrage. Pas de temoin ici: on veut
    // retenter au lancement suivant, pas consommer l'unique tentative.
    logger.info(
      "[Sodium] sodium-options.json pas encore ecrit, reglage reporte au prochain lancement",
    );
    return;
  }

  try {
    const brut = await fs.promises.readFile(fichier, "utf-8");
    const options = JSON.parse(brut) as Record<string, unknown>;

    const poses: string[] = [];
    const ignores: string[] = [];

    for (const reglage of REGLAGES) {
      const section = options[reglage.section];
      if (typeof section !== "object" || section === null) {
        ignores.push(`${reglage.section} (section absente)`);
        continue;
      }

      const contenu = section as Record<string, unknown>;
      const actuel = contenu[reglage.cle];

      // La cle doit exister, et du bon type. Une version de Sodium qui l'aurait
      // renommee ou retypee ne doit pas recevoir une valeur qu'elle ne comprend
      // pas: mieux vaut ne rien poser et le dire.
      if (typeof actuel !== typeof reglage.valeur) {
        ignores.push(
          `${reglage.section}.${reglage.cle} (attendu ${typeof reglage.valeur}, trouve ${typeof actuel})`,
        );
        continue;
      }

      if (actuel === reglage.valeur) {
        continue;
      }

      contenu[reglage.cle] = reglage.valeur;
      poses.push(`${reglage.cle}: ${actuel} -> ${reglage.valeur} (${reglage.pourquoi})`);
    }

    if (ignores.length > 0) {
      logger.warn(`[Sodium] non pose -- ${ignores.join(", ")}`);
    }

    if (poses.length === 0) {
      // Rien a changer: le temoin est quand meme ecrit, sinon on relirait le
      // fichier a chaque lancement pour rien.
      await fs.promises.writeFile(
        markerPath(gameDir),
        JSON.stringify({ appliedAt: new Date().toISOString(), changed: [] }, null, 2),
        "utf-8",
      );
      logger.info("[Sodium] deja aux valeurs voulues");
      return;
    }

    await fs.promises.writeFile(
      fichier,
      `${JSON.stringify(options, null, 4)}\n`,
      "utf-8",
    );
    await fs.promises.writeFile(
      markerPath(gameDir),
      JSON.stringify({ appliedAt: new Date().toISOString(), changed: poses }, null, 2),
      "utf-8",
    );

    logger.info(`[Sodium] ${poses.join(" | ")}`);
  } catch (err) {
    // Un fichier illisible ne doit pas empecher de jouer: Sodium le reecrira
    // lui-meme, et on retentera au lancement suivant.
    logger.warn(
      `[Sodium] reglage ignore: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

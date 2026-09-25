import fs from "node:fs";
import path from "node:path";
import { logger } from "../../logger.js";

/**
 * Fait arriver le mode graphique du profil jusqu'au jeu.
 *
 * <p>Le mode etait demande a la creation, enregistre dans le profil, et servait
 * a choisir un manifeste de mods -- mais il ne touchait aucun reglage video.
 * Choisir « Performance » lancait Minecraft avec ses valeurs d'origine:
 * synchronisation verticale active, graphismes detailles, melange de biomes a
 * cinq. C'est le meme oubli que celui deja corrige sur la resolution, qui
 * etait elle aussi enregistree sans jamais atteindre le jeu.
 *
 * <p>Rien ici ne sort du menu du jeu: on ne fait que poser des valeurs que le
 * joueur pourrait choisir lui-meme, et qu'il peut rechanger a tout moment.
 *
 * <p><strong>Une seule fois, a la creation du profil.</strong> Ces reglages
 * appartiennent au joueur des qu'il y a touche. Les reappliquer a chaque
 * lancement effacerait ses choix a son insu -- exactement ce que fait la ligne
 * de plein ecran, mais celle-la se pilote depuis le launcher et lui appartient.
 */

/**
 * Ce qui reduit la latence sans rien retirer au joueur.
 *
 * <p>Pose sur <strong>tous</strong> les modes, y compris « beauty ». Ce n'est
 * pas un oubli de symetrie avec PRESETS: les valeurs ci-dessous ne sont pas des
 * arbitrages de qualite. Elles ne rabotent rien, elles ne cachent rien, et
 * quelqu'un qui a choisi la qualite les veut autant que les autres.
 *
 * <p>La distinction vient d'une contrainte simple: l'essentiel des joueurs font
 * du PvP, et en PvP une optimisation qui retire de l'information fait perdre le
 * combat qu'elle accelere. Trois reglages ont ete ecartes pour cette raison et
 * ne doivent pas etre remis ici sans y repenser:
 *
 * <ul>
 *   <li>{@code particles} en « minimal »: les particules de coup critique sont
 *       un retour d'information, elles disent que le crit est passe.
 *   <li>{@code entityDistanceScaling} bas: arrete d'afficher les entites
 *       lointaines, donc cache le joueur qui arrive.
 *   <li>{@code simulationDistance} bas: un adversaire loin se met a jour moins
 *       bien.
 * </ul>
 */
const LATENCE: Record<string, string> = {
  /**
   * La visee devient 1:1 avec la main: plus d'acceleration ajoutee par l'OS.
   *
   * <p>Ne gagne aucune image et n'est pas la pour ca. C'est le seul reglage du
   * jeu qui agit directement sur la justesse d'un mouvement de souris, et une
   * courbe d'acceleration rend deux gestes identiques differents a l'ecran.
   */
  rawMouseInput: "true",

  /**
   * 240 plutot que la valeur d'origine de 120, et plutot que l'illimite.
   *
   * <p>Le jeu ne lit les entrees qu'une fois par image: le plafond d'images est
   * donc aussi un plancher de latence. A 120 images, un clic attend jusqu'a
   * 8,3 ms avant d'etre vu; a 240, 4,2 ms.
   *
   * <p>Pas l'illimite -- que le jeu ecrit « 260 » -- pour deux raisons. Une
   * machine qui rend 500 images sans plafond chauffe, et l'etranglement
   * thermique qui suit degrade la regularite, c'est-a-dire precisement ce qu'on
   * cherche a proteger. Et un debit qui oscille entre 300 et 500 fait varier
   * l'intervalle d'echantillonnage des entrees. Un plafond haut mais tenu vaut
   * mieux qu'un sommet plus haut et instable.
   */
  maxFps: "240",
};

/**
 * Valeurs a poser pour un mode donne, celles qui echangent du visuel contre
 * des images. Un mode absent d'ici ne recoit que LATENCE.
 */
const PRESETS: Record<string, Record<string, string>> = {
  /**
   * Le mode qui doit vraiment gagner des images.
   *
   * <p>La distance de rendu n'y figure pas volontairement: c'est le plus gros
   * levier de tous, mais c'est aussi le seul qui change ce que le joueur voit
   * du terrain, et voir loin compte aussi en combat. Elle reste a lui.
   */
  performance: {
    // Enleve jusqu'a une image entiere de latence entre la souris et l'ecran.
    // C'est le reglage le plus utile de la liste pour du PvP, et il ne coute
    // rien visuellement sinon un dechirement possible de l'image.
    enableVsync: "false",
    // Feuillages opaques et eau simplifiee.
    graphicsMode: "@fast",
    // Le degrade entre biomes se recalcule a chaque reconstruction de morceau:
    // le passer a zero accelere nettement les rebonds de framerate quand on se
    // deplace.
    biomeBlendRadius: "0",
    entityShadows: "false",
    renderClouds: '"false"',
  },

  /** Ce qui ne se voit pas, sans toucher a ce qui se voit. */
  balanced: {
    enableVsync: "false",
    biomeBlendRadius: "1",
  },

  // « beauty » n'est pas liste: qui choisit la qualite ne veut pas qu'on la
  // lui rabote.
};

const MARKER_FILE = ".paranoia-graphics.json";

/**
 * Ecrit une cle dans un options.txt, qu'elle y soit deja ou non.
 *
 * <p>Meme forme que la ligne de plein ecran, y compris pour les fins de ligne:
 * un options.txt venu de Windows est en CRLF, et « $ » en mode multiligne
 * s'arrete bien avant le retour chariot.
 */
function setOption(content: string, key: string, value: string): string {
  const pattern = new RegExp(`^${key}:.*$`, "m");
  const line = `${key}:${value}`;

  if (pattern.test(content)) {
    return content.replace(pattern, line);
  }

  const separated =
    content.length > 0 && !content.endsWith("\n") ? content + "\n" : content;
  return separated + line + "\n";
}

/**
 * Resout les valeurs dont l'ecriture a change selon les versions.
 *
 * <p>{@code graphicsMode} s'ecrit tantot par son rang, tantot par son nom entre
 * guillemets selon la version de Minecraft. Plutot que de parier, on regarde
 * comment le fichier l'ecrit deja et on repond dans la meme langue. Sans
 * fichier existant, le rang fait foi -- c'est la forme la plus ancienne et la
 * plus largement acceptee.
 */
function resolve(value: string, key: string, content: string): string {
  if (value !== "@fast") {
    return value;
  }

  const existing = new RegExp(`^${key}:(.*)$`, "m").exec(content)?.[1]?.trim();
  return existing?.startsWith('"') ? '"fast"' : "0";
}

function markerPath(gameDir: string): string {
  return path.join(gameDir, MARKER_FILE);
}

/**
 * Applique le prereglage du mode choisi, sans jamais faire echouer l'appelant.
 */
export async function applyGraphicsPreset(
  gameDir: string,
  graphicsModeId: string,
): Promise<void> {
  // LATENCE s'applique meme a un mode absent de PRESETS: la fonction sortait
  // ici pour « beauty », qui ne recevait donc ni la visee brute ni le plafond
  // d'images -- deux reglages qui ne coutent pourtant aucune qualite.
  const preset = { ...LATENCE, ...PRESETS[graphicsModeId] };

  // Deja pose: le joueur a pu tout changer depuis, on ne revient pas dessus.
  if (fs.existsSync(markerPath(gameDir))) {
    return;
  }

  const optionsPath = path.join(gameDir, "options.txt");

  try {
    let content = "";
    if (fs.existsSync(optionsPath)) {
      content = await fs.promises.readFile(optionsPath, "utf-8");
    }

    for (const [key, value] of Object.entries(preset)) {
      content = setOption(content, key, resolve(value, key, content));
    }

    await fs.promises.mkdir(gameDir, { recursive: true });
    await fs.promises.writeFile(optionsPath, content, "utf-8");
    await fs.promises.writeFile(
      markerPath(gameDir),
      JSON.stringify({ graphicsModeId, appliedAt: new Date().toISOString() }, null, 2),
      "utf-8",
    );

    logger.info(
      `[Graphismes] prereglage « ${graphicsModeId} » applique (${Object.keys(preset).length} reglages)`,
    );
  } catch (err) {
    // Un options.txt illisible ne doit pas empecher de creer un profil, pas
    // plus qu'il n'empeche de jouer ailleurs dans le launcher.
    console.warn(
      "[Graphismes] prereglage non applique:",
      err instanceof Error ? err.message : err,
    );
  }
}

import fs from "node:fs";
import path from "node:path";

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

/** Valeurs a poser pour un mode donne. Un mode absent d'ici ne touche a rien. */
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
  const preset = PRESETS[graphicsModeId];
  if (!preset) {
    return;
  }

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

    console.log(
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

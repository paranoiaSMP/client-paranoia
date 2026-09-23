/**
 * Les drapeaux JVM que le launcher pose lui-meme, selon la version de Java.
 *
 * <p>Ils vivaient dans la valeur par defaut de {@code settings.jvmArgs}, donc
 * dans un champ que le joueur peut editer. Deux problemes a cela. Le champ etait
 * enregistre avec cette valeur, donc un joueur qui n'y avait jamais touche
 * portait quand meme « ses » drapeaux, et les faire evoluer demandait une
 * migration a chaque fois. Et surtout: le bon jeu de drapeaux depend de la
 * version de Java, alors que le champ est unique et global.
 *
 * <p>La version de Java n'est pas un detail ici. Elle vient des metadonnees de
 * Mojang, donc de la version de Minecraft: <strong>21 pour les 1.21.x, 25 pour
 * les 26.x</strong>. Le launcher couvre les deux. Un drapeau valide sur l'une et
 * retire sur l'autre n'est pas un reglage qui se degrade -- c'est un jeu qui ne
 * demarre plus du tout.
 *
 * <h2>Deux regles, et elles ne sont pas negociables</h2>
 *
 * <p><strong>Aucun drapeau experimental.</strong> Mesure faite sur un vrai
 * JDK 21: {@code G1NewSizePercent}, {@code G1MaxNewSizePercent} et
 * {@code G1MixedGCLiveThresholdPercent} font refuser le demarrage avec
 * « is experimental and must be enabled via -XX:+UnlockExperimentalVMOptions ».
 * Ils tournent dans tous les guides de reglage Minecraft, et ils casseraient le
 * jeu ici. On pourrait ajouter le deverrouillage; on ne le fait pas, parce qu'un
 * drapeau experimental peut disparaitre d'un majeur a l'autre sans preavis, et
 * que ce projet en couvre deux.
 *
 * <p><strong>Changer de ramasse-miettes remplace le jeu, il ne s'y ajoute
 * pas.</strong> Mesure faite aussi: {@code -XX:+UseZGC} pose par-dessus les
 * drapeaux G1 ci-dessous donne « Error occurred during initialization of VM ».
 * Le jour ou l'on essaiera ZGC generationnel -- il demarre bien sur 21 -- ce sera
 * une branche entiere de cette fonction, pas une ligne de plus dans la liste.
 *
 * <p>C'est pour ces deux regles que la liste est verifiee en CI contre chaque
 * majeur que le launcher peut choisir, et non seulement relue.
 */

/**
 * Ce qui rend les pauses courtes. Deja en service avant ce module.
 *
 * <p>Minecraft fabrique des millions d'objets a tres courte duree de vie par
 * seconde, et pendant une partie du ramassage le jeu est arrete -- pas ralenti.
 * C'est ce gel qui fait le « 1 % low » bas qu'affiche le HUD.
 */
const PAUSES_COURTES = [
  "-XX:+UseG1GC",

  // Traite en parallele les references faibles, dont le jeu fait un usage
  // massif pour ses textures et ses morceaux de terrain.
  "-XX:+ParallelRefProcEnabled",

  // Rend sans effet les appels a System.gc(). Certains mods en font, et chacun
  // gele le jeu une demi-seconde sans cause visible a l'ecran.
  "-XX:+DisableExplicitGC",

  // Empeche la JVM d'ecrire son fichier de statistiques sur le disque. Quand le
  // disque hoquette, cette ecriture bloque la machine virtuelle entiere: c'est
  // une cause connue de micro-freezes inexplicables.
  "-XX:+PerfDisableSharedMem",

  // 50 ms au lieu des 200 ms par defaut. A soixante images par seconde une image
  // dure seize millisecondes: une pause de 200 ms en fait tomber douze
  // d'affilee. On echange un peu de debit contre des pauses plus courtes, ce qui
  // est exactement le compromis d'un jeu.
  "-XX:MaxGCPauseMillis=50",

  // Avec quatre gigaoctets, G1 choisit des regions de deux megaoctets, et tout
  // objet depassant un megaoctet devient « enorme » et n'est ramasse qu'aux
  // collectes completes. Les tableaux de sections de terrain franchissent ce
  // seuil; des regions de huit megaoctets le repoussent.
  "-XX:G1HeapRegionSize=8M",
];

/**
 * Ce qui rend les pauses rares. Ajoute ici.
 *
 * <p>La distinction compte: le jeu precedent visait la duree d'une pause, celui
 * -ci sa frequence. Une pause de 50 ms qui revient trois fois par seconde coute
 * plus qu'une pause de 50 ms qui revient toutes les dix secondes, et aucun
 * drapeau du premier groupe n'agit sur ce point.
 *
 * <p>Chacun est un drapeau {@code product} verifie sur un vrai JDK, avec sa
 * valeur par defaut notee: sans elle on ne sait pas si on change quelque chose.
 */
const PAUSES_RARES = [
  // Defaut 10. La reserve que G1 garde pour ne pas tomber a court pendant une
  // evacuation. Quand elle ne suffit pas, l'evacuation echoue et G1 se rabat sur
  // une collecte complete -- le gel long, celui qui fait perdre un combat. La
  // doubler coute un peu de tas et achete cette garantie.
  "-XX:G1ReservePercent=20",

  // Defaut 10. Part de chaque pause consacree a la mise a jour des ensembles
  // memorises. En la reduisant, ce travail part vers les fils concurrents et la
  // pause raccourcit d'autant. Va dans le meme sens que MaxGCPauseMillis=50.
  "-XX:G1RSetUpdatingPauseTimePercent=5",

  // Defaut 45. Taux de remplissage a partir duquel G1 commence son marquage
  // concurrent.
  //
  // A ne pas confondre avec ce qu'en disent les guides: G1UseAdaptiveIHOP reste
  // actif -- verifie par PrintFlagsFinal, le drapeau vaut toujours true une fois
  // celui-ci pose -- donc cette valeur ne sert que de point de depart, le temps
  // que G1 ait observe assez de collectes pour decider lui-meme. Son interet est
  // donc precis et limite: les premieres minutes, pendant le chargement du monde,
  // ou une collecte complete declenchee trop tard coute plusieurs secondes.
  "-XX:InitiatingHeapOccupancyPercent=15",

  // Fait reserver tout le tas initial au demarrage, au lieu de laisser l'OS
  // l'accorder page par page en pleine partie. On perd une a deux secondes au
  // lancement, on gagne de ne plus attendre le systeme au premier combat.
  "-XX:+AlwaysPreTouch",
];

/**
 * Les drapeaux a poser pour ce majeur de Java.
 *
 * <p>Le parametre ne sert a rien aujourd'hui, et c'est un resultat, pas un
 * oubli: les dix drapeaux ci-dessus sont tous {@code product} et valides sur 21
 * comme sur 25. Il est la parce que la sonde de CI s'en sert pour eprouver la
 * liste majeur par majeur, et parce que le jour ou une valeur devra differer --
 * ZGC, ou un drapeau retire -- c'est ici que la distinction se fera, et non dans
 * un champ de reglages unique et global.
 *
 * <p><strong>Reserve connue:</strong> si le joueur impose son propre chemin Java
 * dans les parametres, le majeur reellement lance peut ne pas etre celui-ci. Ce
 * n'est pas un probleme tant que la liste est identique partout; le jour ou elle
 * se scindera, il faudra interroger le binaire plutot que de deduire son majeur
 * de la version de Minecraft.
 */
export function tuningFlags(javaMajor: number): string[] {
  if (!Number.isFinite(javaMajor) || javaMajor < 8) {
    // Un majeur absurde ne doit pas produire une ligne de commande absurde: on
    // ne pose rien plutot que de risquer un refus de demarrage.
    return [];
  }

  return [...PAUSES_COURTES, ...PAUSES_RARES];
}

/** Pour la sonde de CI, qui les passe a un vrai `java -version`. */
export const ALL_TUNING_FLAGS = [...PAUSES_COURTES, ...PAUSES_RARES];

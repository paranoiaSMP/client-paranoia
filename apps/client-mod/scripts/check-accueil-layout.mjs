// Eprouve la disposition de l'ecran d'accueil, sans lancer Minecraft.
//
// La colonne de titres est posee par une poignee de constantes, et deux choses
// peuvent mal tourner sans que rien ne le dise:
//
//   1. Les proportions s'ecartent de la maquette. Personne ne s'en apercoit en
//      relisant le code -- il faut mesurer la capture pour le savoir, et c'est
//      fait une fois ici.
//   2. La colonne descend sur la barre d'outils. Ca n'arrive qu'a certaines
//      hauteurs de fenetre, donc jamais sur l'ecran de celui qui a fait la
//      retouche, et toujours sur celui d'un joueur.
//
// Les constantes sont LUES dans TitleController.java et non recopiees ici. Un
// banc qui porterait sa propre copie passerait au vert pendant que le jeu
// dessine autre chose, ce qui est pire que pas de banc du tout.
//
// Usage: node scripts/check-accueil-layout.mjs

import { readFileSync } from "node:fs";

const SOURCE = new URL(
  "../src/main/java/gg/paranoia/client/title/TitleController.java",
  import.meta.url,
);

const java = readFileSync(SOURCE, "utf8");

/** Valeur d'une constante entiere ou flottante du controleur. */
function constante(nom) {
  const trouve = java.match(
    new RegExp(`static final (?:int|float) ${nom} = ([0-9.]+)f?;`),
  );
  if (!trouve) {
    throw new Error(`constante ${nom} introuvable dans TitleController.java`);
  }
  return Number.parseFloat(trouve[1]);
}

const COLONNE_FOND = constante("COLONNE_FOND");
const COLONNE_PART = constante("COLONNE_PART");
const TITRE_ECART = constante("TITRE_ECART");
const LOGO_ECART = constante("LOGO_ECART");
const LOGO_H = constante("LOGO_H");
const OUTIL_FOND = constante("OUTIL_FOND");
const ECHELLE_JOUER = constante("ECHELLE_JOUER");
const ECHELLE_TITRE = constante("ECHELLE_TITRE");

/** Hauteur d'une ligne de la police du jeu. Elle ne bouge pas d'une version a l'autre. */
const POLICE = 9;

/** Reproduit `hautColonne`, `hautLogo` et `dispose` pour une hauteur donnee. */
function pose(hauteur) {
  const colonne =
    hauteur - Math.max(COLONNE_FOND, Math.trunc(hauteur * COLONNE_PART));
  const logo = Math.max(4, colonne - LOGO_ECART - LOGO_H);

  let y = Math.max(logo + LOGO_H + LOGO_ECART, colonne);
  const titres = [];
  for (const echelle of [ECHELLE_JOUER, ECHELLE_TITRE, ECHELLE_TITRE, ECHELLE_TITRE, ECHELLE_TITRE]) {
    const boite = Math.trunc(POLICE * echelle);
    titres.push({ haut: y, boite });
    y += boite + TITRE_ECART;
  }
  return { logo, titres, outils: hauteur - OUTIL_FOND };
}

let echecs = 0;
function verifie(condition, message) {
  if (condition) {
    console.log(`  ok    ${message}`);
    return;
  }
  echecs += 1;
  console.error(`  ECHEC ${message}`);
}

// Releve sur la capture fournie: 1916x1076, soit 958x538 a l'echelle
// d'interface 2. Les blocs de texte ont ete detectes par leurs pixels clairs,
// pas estimes a l'oeil.
const MAQUETTE = {
  hauteur: 538,
  logo: 291,
  titres: [373, 401.5, 424.5, 447.5, 470.5],
  outils: 512,
};

console.log("--- les proportions de la maquette, a la taille de reference");
{
  const { logo, titres, outils } = pose(MAQUETTE.hauteur);
  const pres = (a, b, marge) => Math.abs(a - b) <= marge;

  verifie(pres(logo, MAQUETTE.logo, 2), `le logo commence a ${logo} (maquette ${MAQUETTE.logo})`);
  MAQUETTE.titres.forEach((attendu, i) => {
    verifie(
      pres(titres[i].haut, attendu, 1),
      `titre ${i + 1} a ${titres[i].haut} (maquette ${attendu})`,
    );
  });
  verifie(pres(outils, MAQUETTE.outils, 1), `la barre d'outils a ${outils} (maquette ${MAQUETTE.outils})`);
}

console.log("\n--- la colonne ne doit jamais toucher la barre d'outils");
{
  // De la plus petite fenetre que le jeu accepte aux plus grandes, et aux
  // hauteurs intermediaires ou le plancher prend la main sur la proportion.
  for (const hauteur of [240, 300, 360, 440, 538, 640, 800, 1080, 1440]) {
    const { logo, titres, outils } = pose(hauteur);
    const bas = titres.at(-1).haut + titres.at(-1).boite;
    verifie(
      bas <= outils && logo >= 4,
      `h=${hauteur}: colonne ${titres[0].haut}..${bas}, outils a ${outils}, logo a ${logo}`,
    );
  }
}

console.log("\n--- la part de hauteur est tenue des que la fenetre est assez haute");
{
  for (const hauteur of [640, 800, 1080]) {
    const { titres } = pose(hauteur);
    const part = (hauteur - titres[0].haut) / hauteur;
    verifie(
      Math.abs(part - COLONNE_PART) < 0.01,
      `h=${hauteur}: le premier titre est a ${part.toFixed(3)} du bas (vise ${COLONNE_PART})`,
    );
  }
}

console.log(
  echecs === 0 ? "\nLa disposition suit la maquette." : `\n${echecs} verification(s) en echec.`,
);
process.exit(echecs === 0 ? 0 : 1);

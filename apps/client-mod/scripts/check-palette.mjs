#!/usr/bin/env node
/**
 * Verifie que le menu du mod et le launcher portent la meme gamme.
 *
 * Les deux moities du client ont derive une fois deja, et sans bruit: elles
 * gardaient le meme escalier de clarte, mais le menu etait gris la ou le
 * launcher etait violet -- 5 points d'ecart entre le bleu et le rouge contre
 * 16. Rien ne casse quand cela arrive, rien ne le signale, et on ne s'en
 * apercoit qu'en posant les deux ecrans cote a cote.
 *
 * Ce controle est donc la seule chose qui empeche la derive de recommencer.
 * Il tourne avant la compilation, comme le verificateur de mixins, et pour la
 * meme raison: un ecart de couleur ne se voit pas dans un jar.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");

const CSS = path.join(repo, "apps/launcher/src/styles.css");
const JAVA = path.join(
  repo,
  "apps/client-mod/src/main/java/gg/paranoia/client/menu/MenuTheme.java",
);

/**
 * Constante du menu -> jeton du launcher dont elle doit reprendre la valeur.
 *
 * Les etats -- vert d'allume, rouge d'eteint -- n'y figurent pas: ils ne
 * disent pas la marque mais l'etat, et les ramener sur la gamme effacerait
 * justement ce qu'ils signalent.
 */
const PAIRES = {
  WINDOW: "ground",
  HEADER: "surface",
  SIDEBAR: "surface",
  CARD: "surface",
  CARD_HOVER: "well",
  ACCENT: "accent",
  GUIDE: "accent",
  TEXT: "ink",
  TEXT_DIM: "neutral-500",
  STATE_LOCKED: "neutral-700",
};

const css = readFileSync(CSS, "utf8");
const java = readFileSync(JAVA, "utf8");

const jeton = (nom) => {
  const m = css.match(new RegExp(`--color-${nom}:\\s*(#[0-9a-fA-F]{6})`));
  return m ? m[1].toLowerCase() : null;
};

// L'alpha du mod ne regarde pas le launcher: une fenetre posee sur le jeu a
// besoin d'etre translucide, une div n'a pas ce probleme. Seuls les six
// chiffres de couleur sont compares.
const constante = (nom) => {
  const m = java.match(
    new RegExp(`public static final int ${nom} = 0x([0-9A-Fa-f]{8})`),
  );
  return m ? `#${m[1].slice(2)}`.toLowerCase() : null;
};

const ecarts = [];
for (const [nom, tokenName] of Object.entries(PAIRES)) {
  const attendu = jeton(tokenName);
  const trouve = constante(nom);

  if (attendu === null) {
    ecarts.push(`${nom}: --color-${tokenName} est absent de styles.css`);
    continue;
  }
  if (trouve === null) {
    ecarts.push(`${nom}: constante introuvable dans MenuTheme.java`);
    continue;
  }
  if (attendu !== trouve) {
    ecarts.push(
      `${nom} = ${trouve} mais --color-${tokenName} = ${attendu}`,
    );
  }
}

if (ecarts.length > 0) {
  console.error("La gamme du menu a derive de celle du launcher:\n");
  for (const e of ecarts) console.error(`  ${e}`);
  console.error(
    "\nLes deux doivent porter la meme valeur. Corriger celle qui a bouge --",
  );
  console.error(
    "et si le changement est voulu, le faire des deux cotes dans le meme commit.",
  );
  process.exit(1);
}

console.log(
  `Gamme accordee: ${Object.keys(PAIRES).length} constantes du menu ` +
    `identiques a leur jeton du launcher.`,
);

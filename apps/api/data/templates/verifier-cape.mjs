#!/usr/bin/env node
/**
 * Verifie qu'un PNG est utilisable comme cape, avant de le mettre en ligne.
 *
 * <p>Le seul defaut qui compte ne se voit pas a l'oeil: une proportion autre
 * que 2:1 decale tout le decoupage, et la cape affiche alors un morceau de
 * doublure sur sa face visible. Rien ne le signale en jeu -- la texture se
 * charge, elle est simplement fausse.
 *
 * <p>Aucune dependance: les dimensions d'un PNG tiennent dans les 24 premiers
 * octets du fichier, et les lire soi-meme coute moins cher que d'installer
 * une bibliotheque d'images sur un serveur.
 *
 *   node verifier-cape.mjs ma_cape.png
 */

import { openSync, readSync, closeSync } from "node:fs";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function dimensions(chemin) {
  const entete = Buffer.alloc(24);
  const descripteur = openSync(chemin, "r");
  try {
    readSync(descripteur, entete, 0, 24, 0);
  } finally {
    closeSync(descripteur);
  }

  if (!entete.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error(
      "Ce n'est pas un PNG. Un JPEG reenregistre en .png reste un JPEG: " +
        "sa compression invente des pixels et il ne gere pas la transparence.",
    );
  }

  // IHDR suit immediatement la signature: 4 octets de longueur, 4 de type,
  // puis largeur et hauteur en entiers 32 bits gros-boutistes.
  return { largeur: entete.readUInt32BE(16), hauteur: entete.readUInt32BE(20) };
}

const chemin = process.argv[2];
if (!chemin) {
  console.error("Usage: node verifier-cape.mjs <fichier.png>");
  process.exit(2);
}

let taille;
try {
  taille = dimensions(chemin);
} catch (err) {
  console.error(`REFUSE  ${err.message}`);
  process.exit(1);
}

const { largeur, hauteur } = taille;
console.log(`Fichier   ${chemin}`);
console.log(`Dimensions ${largeur} x ${hauteur}`);

if (largeur !== hauteur * 2) {
  console.error(
    `\nREFUSE  La proportion doit etre 2:1, celle-ci est ${(largeur / hauteur).toFixed(3)}:1.\n` +
      `        Pour cette hauteur, la largeur devrait etre ${hauteur * 2}.\n` +
      `        Un autre ratio decale le decoupage: la face visible afficherait\n` +
      `        un morceau de la doublure, sans qu'aucune erreur ne le signale.`,
  );
  process.exit(1);
}

if (largeur % 64 !== 0) {
  console.error(
    `\nREFUSE  La largeur doit etre un multiple de 64 (64, 128, 256, 512, 1024...).\n` +
      `        Sinon les bords des zones tombent entre deux pixels et bavent.`,
  );
  process.exit(1);
}

const facteur = largeur / 64;
console.log(`Facteur    x${facteur} par rapport au format de reference`);
console.log(`Face visible ${10 * facteur} x ${16 * facteur} pixels reels`);

if (facteur === 1) {
  console.log("\nOK  Format de reference, celui de Mojang.");
} else if (facteur <= 16) {
  console.log(`\nOK  Cape haute definition. Le jeu echantillonne la texture en`);
  console.log(`    proportions, la resolution n'a donc pas a etre celle d'origine.`);
} else {
  console.log(
    `\nOK, mais ${largeur} x ${hauteur} est tres grand pour une cape:\n` +
      `    chaque joueur telecharge ce fichier, et l'ecart avec x16 ne se voit\n` +
      `    pas a l'ecran.`,
  );
}

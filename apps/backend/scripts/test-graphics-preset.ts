// Eprouve applyGraphicsPreset sur un options.txt reel.
//
// Ce banc existe surtout pour une raison qui n'est pas technique: l'essentiel
// des joueurs font du PvP, et en PvP une optimisation qui retire de
// l'information fait perdre le combat qu'elle accelere. Trois reglages sont donc
// interdits ici, et la liste JAMAIS est la pour qu'on ne les remette pas un jour
// « pour gagner des images »:
//
//   - particles en minimal: les particules de coup critique disent que le crit
//     est passe. C'est un retour d'information, pas de la decoration.
//   - entityDistanceScaling bas: cache le joueur qui arrive.
//   - simulationDistance bas: un adversaire loin se met a jour moins bien.
//
// Une regle qui ne vit que dans un commentaire finit par se faire casser. Celle
// -ci fait echouer la CI.
//
// Le reste verifie ce que la relecture ne montre pas: que « beauty », absent de
// PRESETS, recoit bien les reglages de latence -- il n'en recevait aucun -- et
// que le temoin empeche un second passage de reprendre au joueur des choix qu'il
// a faits exprès.
//
// Usage: pnpm exec tsx scripts/test-graphics-preset.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applyGraphicsPreset } from "../src/modules/launcher/graphicsPreset.js";

const ATTENDU_PARTOUT = ["rawMouseInput:true", "maxFps:240"];
const JAMAIS = ["particles:", "entityDistanceScaling:", "simulationDistance:"];

let echecs = 0;

function verifie(condition: boolean, message: string) {
  if (!condition) {
    echecs++;
    console.log(`  ECHEC ${message}`);
  }
}

async function cas(nom: string, mode: string, depart: string | null) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "preset-"));
  const options = path.join(dir, "options.txt");
  if (depart !== null) {
    fs.writeFileSync(options, depart);
  }

  await applyGraphicsPreset(dir, mode);

  const ecrit = fs.existsSync(options) ? fs.readFileSync(options, "utf-8") : "";
  const lignes = ecrit.split("\n").filter((l) => l.trim().length > 0);
  console.log(`\n--- ${nom}  (${lignes.length} lignes)`);
  for (const ligne of lignes.sort()) {
    console.log(`      ${ligne}`);
  }

  for (const attendu of ATTENDU_PARTOUT) {
    verifie(lignes.includes(attendu), `${nom}: ${attendu} absent`);
  }
  for (const interdit of JAMAIS) {
    verifie(
      !lignes.some((l) => l.startsWith(interdit)),
      `${nom}: ${interdit} ecrit alors qu'il retire de l'information`,
    );
  }

  // Le temoin doit empecher un second passage d'ecraser les choix du joueur.
  const avant = ecrit;
  fs.writeFileSync(options, `${ecrit}maxFps:60\n`);
  await applyGraphicsPreset(dir, mode);
  const apres = fs.readFileSync(options, "utf-8");
  verifie(
    apres === `${avant}maxFps:60\n`,
    `${nom}: le second passage a rejoue le prereglage`,
  );

  return lignes;
}

// Le mode qui n'est pas dans PRESETS: c'est lui qui ne recevait rien du tout.
const beauty = await cas("beauty (absent de PRESETS)", "beauty", null);
verifie(
  beauty.length === 2,
  `beauty devrait recevoir les deux reglages de latence et rien d'autre, recu ${beauty.length}`,
);

await cas("performance", "performance", null);
await cas("balanced", "balanced", null);
await cas("mode inconnu", "nawak", null);

// Un options.txt venu d'une version qui ecrit graphicsMode entre guillemets.
const cite = await cas(
  "performance sur un options.txt cite",
  "performance",
  'graphicsMode:"fancy"\nmaxFps:120\nrawMouseInput:false\n',
);
verifie(
  cite.includes('graphicsMode:"fast"'),
  "la forme citee de graphicsMode n'a pas ete respectee",
);
verifie(
  !cite.some((l) => l === "maxFps:120" || l === "rawMouseInput:false"),
  "les anciennes valeurs n'ont pas ete remplacees mais dupliquees",
);

console.log(
  echecs === 0 ? "\nTout est vert." : `\n${echecs} verification(s) en echec.`,
);
process.exit(echecs === 0 ? 0 : 1);

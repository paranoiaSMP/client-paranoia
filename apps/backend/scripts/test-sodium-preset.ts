// Eprouve le reglage de Sodium sur de vrais fichiers.
//
// Le risque ici n'est pas de rater un gain, c'est d'abimer la configuration d'un
// joueur: ce module ecrit dans un fichier que Sodium relira, et qui contient
// aussi tout ce que le joueur y a regle lui-meme. Une ecriture maladroite ne se
// verrait pas dans la CI et se verrait tres bien en jeu.
//
// Le gabarit ci-dessous n'est pas invente: c'est la forme lue dans le jar par la
// sonde de build-mod.yml -- sections quality / performance / advanced / debug /
// notifications, cles en camelCase. C'est tout l'interet d'etre passe par la
// sonde plutot que par un guide en ligne, qui les ecrit en snake_case.
//
// Usage: pnpm exec tsx scripts/test-sodium-preset.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { applySodiumPreset } from "../src/modules/launcher/sodiumPreset.js";

const MARQUEUR = ".paranoia-sodium.json";

/** La forme reelle, telle que la sonde l'a lue dans SodiumGameOptions. */
function fichierDOrigine(): Record<string, unknown> {
  return {
    quality: {
      weatherQuality: "DEFAULT",
      leavesQuality: "DEFAULT",
      enableVignette: true,
    },
    performance: {
      chunkBuilderThreads: 0,
      chunkBuildDeferMode: "ONE_FRAME",
      animateOnlyVisibleTextures: true,
      useEntityCulling: true,
      useFogOcclusion: true,
      useBlockFaceCulling: true,
      useNoErrorGLContext: false,
      quadSplittingMode: "DEFAULT",
    },
    advanced: {
      enableMemoryTracing: false,
      useAdvancedStagingBuffers: true,
      cpuRenderAheadLimit: 3,
    },
    debug: { terrainSortingEnabled: true },
    notifications: { hasClearedDonationButton: false, hasSeenDonationPrompt: true },
  };
}

let echecs = 0;

function verifie(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ok    ${message}`);
    return;
  }
  echecs++;
  console.log(`  ECHEC ${message}`);
}

function dossier(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "sodium-"));
}

function ecrit(dir: string, relatif: string, contenu: unknown): string {
  const complet = path.join(dir, relatif);
  fs.mkdirSync(path.dirname(complet), { recursive: true });
  fs.writeFileSync(
    complet,
    typeof contenu === "string" ? contenu : JSON.stringify(contenu, null, 4),
  );
  return complet;
}

function relit(chemin: string): any {
  return JSON.parse(fs.readFileSync(chemin, "utf-8"));
}

console.log("--- le cas ordinaire");
{
  const dir = dossier();
  const fichier = ecrit(dir, "config/sodium-options.json", fichierDOrigine());
  await applySodiumPreset(dir);

  const apres = relit(fichier);
  verifie(apres.advanced.cpuRenderAheadLimit === 1, "cpuRenderAheadLimit passe a 1");
  verifie(apres.quality.enableVignette === false, "enableVignette passe a false");
  verifie(fs.existsSync(path.join(dir, MARQUEUR)), "le temoin est ecrit");

  // Le point le plus important du banc: on ecrit dans un fichier qui contient
  // aussi les choix du joueur.
  const origine = fichierDOrigine() as any;
  verifie(
    JSON.stringify(apres.performance) === JSON.stringify(origine.performance),
    "la section performance est intacte",
  );
  verifie(
    apres.quality.weatherQuality === "DEFAULT" &&
      apres.quality.leavesQuality === "DEFAULT",
    "les autres cles de quality sont intactes",
  );
  verifie(
    apres.advanced.useAdvancedStagingBuffers === true &&
      apres.advanced.enableMemoryTracing === false,
    "les autres cles de advanced sont intactes",
  );
  verifie(
    JSON.stringify(apres.debug) === JSON.stringify(origine.debug) &&
      JSON.stringify(apres.notifications) === JSON.stringify(origine.notifications),
    "debug et notifications sont intactes",
  );
  verifie(
    apres.performance.chunkBuildDeferMode === "ONE_FRAME",
    "chunkBuildDeferMode n'est pas touche: il retarderait les blocs poses",
  );
}

console.log("\n--- le fichier n'existe pas encore");
{
  const dir = dossier();
  await applySodiumPreset(dir);
  verifie(
    !fs.existsSync(path.join(dir, MARQUEUR)),
    "aucun temoin: la tentative n'est pas consommee",
  );
  verifie(
    !fs.existsSync(path.join(dir, "config", "sodium-options.json")) &&
      !fs.existsSync(path.join(dir, "sodium-options.json")),
    "aucun fichier cree: c'est a Sodium de l'ecrire",
  );

  // Sodium l'ecrit, puis le lancement suivant pose le reglage.
  const fichier = ecrit(dir, "config/sodium-options.json", fichierDOrigine());
  await applySodiumPreset(dir);
  verifie(
    relit(fichier).advanced.cpuRenderAheadLimit === 1,
    "le lancement suivant pose bien le reglage",
  );
}

console.log("\n--- le joueur a repris la main");
{
  const dir = dossier();
  const fichier = ecrit(dir, "config/sodium-options.json", fichierDOrigine());
  await applySodiumPreset(dir);
  // Il remet ce qu'il veut, et relance.
  const sien = relit(fichier);
  sien.advanced.cpuRenderAheadLimit = 3;
  sien.quality.enableVignette = true;
  fs.writeFileSync(fichier, JSON.stringify(sien, null, 4));

  await applySodiumPreset(dir);
  const apres = relit(fichier);
  verifie(
    apres.advanced.cpuRenderAheadLimit === 3 && apres.quality.enableVignette === true,
    "ses valeurs lui restent: le temoin empeche de repasser derriere lui",
  );
}

console.log("\n--- l'autre emplacement possible");
{
  const dir = dossier();
  const fichier = ecrit(dir, "sodium-options.json", fichierDOrigine());
  await applySodiumPreset(dir);
  verifie(
    relit(fichier).advanced.cpuRenderAheadLimit === 1,
    "le fichier a la racine est trouve aussi",
  );
}

console.log("\n--- une version de Sodium qui a change sa forme");
{
  const dir = dossier();
  const bizarre = fichierDOrigine() as any;
  bizarre.advanced.cpuRenderAheadLimit = "trois"; // retype
  delete bizarre.quality; // section disparue
  const fichier = ecrit(dir, "config/sodium-options.json", bizarre);

  await applySodiumPreset(dir);
  const apres = relit(fichier);
  verifie(
    apres.advanced.cpuRenderAheadLimit === "trois",
    "une cle retypee n'est pas ecrasee",
  );
  verifie(apres.quality === undefined, "une section absente n'est pas inventee");
  verifie(
    JSON.stringify(apres.performance) ===
      JSON.stringify((fichierDOrigine() as any).performance),
    "le reste du fichier survit",
  );
}

console.log("\n--- un fichier illisible");
{
  const dir = dossier();
  const fichier = ecrit(dir, "config/sodium-options.json", "{ ceci n'est pas du JSON");
  await applySodiumPreset(dir);
  verifie(
    fs.readFileSync(fichier, "utf-8") === "{ ceci n'est pas du JSON",
    "il est laisse tel quel",
  );
  verifie(
    !fs.existsSync(path.join(dir, MARQUEUR)),
    "aucun temoin: Sodium le reecrira et on retentera",
  );
}

console.log("\n--- deja aux valeurs voulues");
{
  const dir = dossier();
  const deja = fichierDOrigine() as any;
  deja.advanced.cpuRenderAheadLimit = 1;
  deja.quality.enableVignette = false;
  const fichier = ecrit(dir, "config/sodium-options.json", deja);
  const avant = fs.readFileSync(fichier, "utf-8");

  await applySodiumPreset(dir);
  verifie(
    fs.readFileSync(fichier, "utf-8") === avant,
    "le fichier n'est pas reecrit pour rien",
  );
  verifie(
    fs.existsSync(path.join(dir, MARQUEUR)),
    "le temoin est ecrit quand meme: on ne relit pas a chaque lancement",
  );
}

console.log(
  echecs === 0 ? "\nTout est vert." : `\n${echecs} verification(s) en echec.`,
);
process.exit(echecs === 0 ? 0 : 1);

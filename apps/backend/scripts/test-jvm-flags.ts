// Eprouve les drapeaux JVM que le launcher pose, en les donnant a une vraie JVM.
//
// Pourquoi une vraie JVM et pas une relecture: un drapeau refuse n'est pas un
// reglage qui se degrade, c'est un jeu qui ne demarre plus. Et la relecture ne
// suffit pas a le savoir -- trois drapeaux presents dans tous les guides de
// reglage Minecraft (G1NewSizePercent, G1MaxNewSizePercent,
// G1MixedGCLiveThresholdPercent) sont experimentaux et font echouer le
// demarrage. Ils ont failli partir dans cette liste.
//
// Ce banc verifie donc chaque drapeau un par un, puis la liste entiere avec la
// memoire reelle du launcher. Il verrouille aussi deux faits mesures qu'un
// lecteur presse pourrait defaire:
//
//   - aucun drapeau n'ouvre les options experimentales;
//   - `-XX:+UseZGC` ne s'ajoute pas a ce jeu, il le remplace: pose par-dessus,
//     la machine virtuelle refuse de s'initialiser.
//
// A lancer une fois par majeur de Java que le launcher peut choisir: 21 pour les
// 1.21.x, 25 pour les 26.x. Le binaire se donne par JAVA_BIN; sans JVM, les
// verifications de texte tournent quand meme et les lancements sont annonces
// comme sautes plutot que tus.
//
// Usage: pnpm exec tsx scripts/test-jvm-flags.ts
//        JAVA_BIN=/chemin/vers/java pnpm exec tsx scripts/test-jvm-flags.ts

import { execFileSync, spawnSync } from "node:child_process";
import { ALL_TUNING_FLAGS, tuningFlags } from "../src/modules/launcher/jvmFlags.js";
import {
  estUnAncienDefaut,
  settingsSchema,
} from "../src/modules/settings/settings.store.js";

const JAVA = process.env.JAVA_BIN ?? "java";

/**
 * L'environnement sans JAVA_TOOL_OPTIONS.
 *
 * <p>La variable est retiree et non videe: vide, la JVM annonce quand meme
 * « Picked up JAVA_TOOL_OPTIONS: » sur sa sortie d'erreur, ce qui prenait la
 * place de la version dans le journal. Et son contenu -- un mandataire, un magasin
 * de certificats -- brouillerait ce qu'on mesure: on veut savoir ce que font nos
 * drapeaux, seuls.
 */
const ENV = (() => {
  const propre = { ...process.env };
  delete propre.JAVA_TOOL_OPTIONS;
  return propre;
})();

let echecs = 0;

function verifie(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ok    ${message}`);
    return;
  }
  echecs++;
  console.log(`  ECHEC ${message}`);
}

/** Lance la JVM avec ces arguments. Rend null si elle demarre, son refus sinon. */
function refusDe(args: string[]): string | null {
  try {
    execFileSync(JAVA, [...args, "-version"], {
      stdio: "pipe",
      env: ENV,
      timeout: 60_000,
    });
    return null;
  } catch (err) {
    const sortie = err as { stderr?: Buffer; stdout?: Buffer; message?: string };
    const texte =
      sortie.stderr?.toString() || sortie.stdout?.toString() || sortie.message || "";
    return texte.split("\n").find((l) => l.trim().length > 0)?.trim() ?? "refus sans message";
  }
}

function jvmDisponible(): boolean {
  try {
    execFileSync(JAVA, ["-version"], {
      stdio: "pipe",
      env: ENV,
      timeout: 60_000,
    });
    return true;
  } catch {
    return false;
  }
}

console.log("--- la liste elle-meme");

verifie(ALL_TUNING_FLAGS.length > 0, "la liste n'est pas vide");
verifie(
  tuningFlags(21).join(" ") === ALL_TUNING_FLAGS.join(" "),
  "tuningFlags(21) rend bien la liste complete",
);
verifie(
  tuningFlags(25).join(" ") === ALL_TUNING_FLAGS.join(" "),
  "tuningFlags(25) rend bien la liste complete",
);

// Un majeur absurde ne doit pas produire une ligne de commande absurde.
for (const absurde of [0, -1, 7, Number.NaN, Number.POSITIVE_INFINITY]) {
  verifie(
    tuningFlags(absurde).length === 0,
    `tuningFlags(${absurde}) ne pose aucun drapeau`,
  );
}

// La regle du module: pas d'options experimentales, donc pas de deverrouillage.
verifie(
  !ALL_TUNING_FLAGS.some((f) => f.includes("Unlock")),
  "aucun drapeau n'ouvre les options experimentales",
);
verifie(
  new Set(ALL_TUNING_FLAGS).size === ALL_TUNING_FLAGS.length,
  "aucun drapeau n'est repete",
);

console.log("\n--- le champ des parametres");

verifie(
  settingsSchema.parse({}).jvmArgs === "",
  "le champ du joueur est vide par defaut",
);
verifie(estUnAncienDefaut("-XX:+UseG1GC"), "le tout premier defaut est reconnu");
verifie(
  estUnAncienDefaut(
    "-XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:+DisableExplicitGC" +
      " -XX:+PerfDisableSharedMem -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=8M",
  ),
  "le jeu de six drapeaux est reconnu",
);
verifie(
  estUnAncienDefaut("  -XX:+UseG1GC   -XX:+ParallelRefProcEnabled " +
    "-XX:+DisableExplicitGC -XX:+PerfDisableSharedMem -XX:MaxGCPauseMillis=50 " +
    "-XX:G1HeapRegionSize=8M  "),
  "un espacement different est reconnu quand meme",
);
verifie(
  !estUnAncienDefaut("-Xss2M"),
  "une valeur saisie par le joueur n'est pas effacee",
);
verifie(
  !estUnAncienDefaut("-XX:+UseG1GC -Xss2M"),
  "un defaut auquel le joueur a ajoute quelque chose n'est pas efface",
);

console.log("\n--- la vraie JVM");

if (!jvmDisponible()) {
  console.log(`  saute  aucune JVM a « ${JAVA} »: les lancements ne sont pas eprouves`);
} else {
  // spawnSync et non execFileSync: `java -version` ecrit sur la sortie d'erreur,
  // que execFileSync ne rend pas -- la ligne affichee restait vide. Savoir quel
  // JDK a reellement tourne est tout l'interet de cette ligne dans un journal de
  // CI, ou le meme banc passe une fois par majeur.
  const sonde = spawnSync(JAVA, ["-version"], {
    env: ENV,
    encoding: "utf-8",
    timeout: 60_000,
  });
  const version = `${sonde.stderr ?? ""}${sonde.stdout ?? ""}`
    .split("\n")
    .find((l) => l.trim().length > 0)
    ?.trim();
  console.log(`  JVM    ${JAVA} -- ${version ?? "version illisible"}`);

  // Un par un: c'est ce qui nomme le coupable. La liste entiere dirait seulement
  // qu'elle echoue.
  for (const flag of ALL_TUNING_FLAGS) {
    const refus = refusDe([flag]);
    verifie(refus === null, `${flag}${refus ? ` -- ${refus}` : ""}`);
  }

  // Puis ensemble, avec la memoire que le launcher demande reellement.
  const memoire = ["-Xmx4096M", "-Xms2048M"];
  const refusEnsemble = refusDe([...ALL_TUNING_FLAGS, ...memoire]);
  verifie(
    refusEnsemble === null,
    `la liste entiere avec ${memoire.join(" ")}${refusEnsemble ? ` -- ${refusEnsemble}` : ""}`,
  );

  // Les deux faits mesures qu'on ne veut pas voir defaits.
  verifie(
    refusDe([...ALL_TUNING_FLAGS, "-XX:G1NewSizePercent=30"]) !== null,
    "un drapeau experimental est bien refuse sans deverrouillage",
  );
  verifie(
    refusDe([...ALL_TUNING_FLAGS, ...memoire, "-XX:+UseZGC"]) !== null,
    "UseZGC ne s'ajoute pas a ce jeu: changer de ramasse-miettes le remplace",
  );
}

console.log(
  echecs === 0
    ? "\nTout est vert."
    : `\n${echecs} verification(s) en echec.`,
);
process.exit(echecs === 0 ? 0 : 1);

// Eprouve la detection des Java installes, contre de faux binaires.
//
// Ce que ce banc protege: un joueur dont le launcher ne trouve aucun Java.
//
// Le launcher n'en cherchait nulle part. Il telechargeait le sien, et le champ
// « chemin Java » des parametres attendait un chemin absolu tape a la main --
// que personne ne connait. Le jour ou le telechargement echoue (antivirus,
// disque plein, reseau d'entreprise), il n'y avait plus rien, alors que la
// machine porte presque toujours le Java du launcher Mojang.
//
// La regle que ce banc tient: on interroge le binaire, on ne lit pas son
// chemin. Un dossier nomme `jre-17` peut contenir n'importe quoi, et un script
// appele `java` n'est pas un Java. C'est la seule facon de ne pas proposer au
// joueur un chemin qui echouera au lancement.
//
// Les faux binaires sont des scripts qui impriment ce qu'imprime une vraie JVM:
// aucun Java n'est necessaire pour faire tourner ce banc.
//
// Usage: pnpm exec tsx scripts/test-java-detect.ts

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let echecs = 0;

function verifie(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ok    ${message}`);
    return;
  }
  echecs++;
  console.log(`  ECHEC ${message}`);
}

/**
 * Un faux `java` qui repond comme une vraie JVM.
 *
 * <p>`-XshowSettings:properties -version` ecrit sur la sortie d'erreur, comme
 * le vrai: c'est ce que le detecteur lit.
 */
function fauxJava(
  racine: string,
  version: string,
  vendeur = "Eclipse Adoptium",
  arch = "amd64",
): string {
  const bin = path.join(racine, "bin");
  fs.mkdirSync(bin, { recursive: true });
  const chemin = path.join(bin, "java");
  // `printf` et non `cat <<FIN`: un des scenarios remplace le PATH par le seul
  // dossier du faux Java, et `cat` ne serait alors plus trouvable. `printf` est
  // integre au shell, donc il ne depend de rien.
  fs.writeFileSync(
    chemin,
    `#!/bin/sh
printf '%s\\n' \\
  'Property settings:' \\
  '    java.version = ${version}' \\
  '    java.vendor = ${vendeur}' \\
  '    os.arch = ${arch}' \\
  '' \\
  'openjdk version "${version}"' >&2
exit 0
`,
    { mode: 0o755 },
  );
  return chemin;
}

/** Un fichier executable qui n'est pas un Java du tout. */
function fauxTout(racine: string, nom: string, corps: string): string {
  fs.mkdirSync(racine, { recursive: true });
  const chemin = path.join(racine, nom);
  fs.writeFileSync(chemin, `#!/bin/sh\n${corps}\n`, { mode: 0o755 });
  return chemin;
}

function dossierJetable(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "java-"));
}

let compteur = 0;

/** Le module, charge a neuf avec l'environnement du scenario. */
async function charge(env: Record<string, string>) {
  for (const [cle, valeur] of Object.entries(env)) {
    process.env[cle] = valeur;
  }
  compteur++;
  return import(`../src/modules/launcher/javaDetect.js?essai=${compteur}`);
}

async function principal() {
  if (process.platform === "win32") {
    console.log("Banc prevu pour un systeme POSIX (scripts shell): ignore.");
    return;
  }

  console.log("\n--- la majeure, dans les deux ecritures de Java");
  {
    const { majorDepuisVersion } = await charge({});
    const cas: Array<[string, number]> = [
      ["1.8.0_412", 8],
      ["1.7.0_80", 7],
      ["21.0.5", 21],
      ["25", 25],
      ["17.0.9+9", 17],
      ["", 0],
      ["inconnue", 0],
    ];
    for (const [version, attendu] of cas) {
      const vu = majorDepuisVersion(version);
      verifie(vu === attendu, `« ${version || "(vide)"} » donne ${attendu} (vu ${vu})`);
    }
  }

  console.log("\n--- sonder un binaire: on interroge, on ne devine pas");
  {
    const racine = dossierJetable();
    const { sondeJava } = await charge({});

    const vrai = fauxJava(path.join(racine, "jdk-21"), "21.0.5", "Amazon.com Inc.", "aarch64");
    const sonde = await sondeJava(vrai, "banc");
    verifie(sonde?.major === 21, `la majeure est lue (${sonde?.major})`);
    verifie(sonde?.version === "21.0.5", `la version est lue (${sonde?.version})`);
    verifie(sonde?.vendeur === "Amazon.com Inc.", `le vendeur est lu (${sonde?.vendeur})`);
    verifie(sonde?.arch === "aarch64", `l'architecture est lue (${sonde?.arch})`);
    verifie(sonde?.origine === "banc", "l'origine est conservee");

    // Un dossier nomme comme un Java, avec un binaire qui n'en est pas un.
    const imposteur = fauxTout(path.join(racine, "jre-17", "bin"), "java", "echo bonjour");
    verifie(
      (await sondeJava(imposteur)) === null,
      "un faux `java` dans un dossier `jre-17` est refuse",
    );

    verifie(
      (await sondeJava(path.join(racine, "nulle-part", "java"))) === null,
      "un chemin inexistant est refuse",
    );

    // Une version que le detecteur ne sait pas lire ne doit pas passer pour
    // Java 0 ni faire tomber la detection entiere.
    const muet = fauxTout(path.join(racine, "muet"), "java", "exit 1");
    verifie((await sondeJava(muet)) === null, "un binaire qui ne dit rien est refuse");
  }

  console.log("\n--- un binaire qui se fige n'arrete pas la detection");
  {
    const racine = dossierJetable();
    const { sondeJava } = await charge({});
    const fige = fauxTout(path.join(racine, "fige"), "java", "sleep 30");

    const debut = Date.now();
    const sonde = await sondeJava(fige);
    const duree = Date.now() - debut;

    verifie(sonde === null, "il est refuse");
    verifie(
      duree < 9000,
      `et on n'a pas attendu ses trente secondes (${Math.round(duree / 1000)} s)`,
    );
  }

  console.log("\n--- detecter: JAVA_HOME, le PATH, et ce que Paranoia a telecharge");
  {
    const racine = dossierJetable();
    const donnees = path.join(racine, "donnees", "paranoia-client");

    const maison = path.join(racine, "jdk-17");
    fauxJava(maison, "17.0.9");
    const surLePath = path.join(racine, "chemin");
    fauxJava(surLePath, "1.8.0_412", "Oracle Corporation");
    fauxJava(path.join(donnees, "jre-21"), "21.0.5");
    // Un dossier du dossier de donnees qui n'est pas un runtime: il ne doit pas
    // etre pris pour un Java.
    fs.mkdirSync(path.join(donnees, "instances"), { recursive: true });

    const { detecteJava, javaInstallePour } = await charge({
      JAVA_HOME: maison,
      PATH: path.join(surLePath, "bin"),
      XDG_DATA_HOME: path.join(racine, "donnees"),
    });

    const tous = await detecteJava();
    // La machine qui fait tourner ce banc a ses propres Java -- un runner de CI
    // en a plusieurs. On verifie donc ce qu'on a pose, sans exiger que rien
    // d'autre ne soit trouve: le contraire ferait echouer le banc precisement
    // sur les machines bien equipees.
    const miens = tous.filter((j: any) => j.chemin.startsWith(racine));
    const parMajeure = new Map(miens.map((j: any) => [j.major, j]));

    verifie(miens.length === 3, `les trois poses sont trouves (${miens.length})`);
    verifie(parMajeure.get(21)?.origine === "telecharge par Paranoia", "celui du launcher est reconnu");
    verifie(parMajeure.get(17)?.origine === "JAVA_HOME", "celui de JAVA_HOME est reconnu");
    verifie(parMajeure.get(8)?.origine === "PATH", "celui du PATH est reconnu");
    verifie(
      miens.map((j: any) => j.major).join(",") === "21,17,8",
      `du plus recent au plus ancien (${miens.map((j: any) => j.major).join(",")})`,
    );
    verifie(
      parMajeure.get(8)?.version === "1.8.0_412",
      "un Java 8 est reconnu malgre son ecriture en 1.x",
    );
    verifie(
      !tous.some((j: any) => j.chemin.includes("instances")),
      "un dossier de donnees qui n'est pas un runtime n'est pas pris pour un Java",
    );

    verifie(
      (await javaInstallePour(17))?.chemin === path.join(maison, "bin", "java"),
      "on sait repondre « le Java 17 de cette machine »",
    );
    verifie(
      (await javaInstallePour(99)) === null,
      "et repondre « aucun » plutot que d'en proposer un autre: Minecraft refuse une majeure qui n'est pas la sienne",
    );
  }

  console.log("\n--- le meme binaire par deux chemins n'est compte qu'une fois");
  {
    const racine = dossierJetable();
    const maison = path.join(racine, "jdk-21");
    fauxJava(maison, "21.0.5");

    const { detecteJava } = await charge({
      JAVA_HOME: maison,
      // Le meme binaire, atteint par le PATH cette fois.
      PATH: path.join(maison, "bin"),
      XDG_DATA_HOME: path.join(racine, "vide"),
    });

    const tous = await detecteJava();
    const miens = tous.filter((j: any) => j.chemin.startsWith(racine));
    verifie(
      miens.length === 1,
      `une seule entree pour ce binaire, atteint par deux chemins (${miens.length})`,
    );
  }

  console.log(
    echecs === 0
      ? "\nTous les scenarios sont verts"
      : `\n${echecs} verification(s) en echec`,
  );
  process.exit(echecs === 0 ? 0 : 1);
}

principal().catch((err) => {
  console.error(err);
  process.exit(1);
});

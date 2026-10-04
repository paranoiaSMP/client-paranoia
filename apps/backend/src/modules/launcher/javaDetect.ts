import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { paranoiaDataDir } from "./paths.js";

const execFileAsync = promisify(execFile);

/**
 * Retrouve les Java deja installes sur la machine.
 *
 * <p>Le launcher ne les cherchait nulle part. Il telechargeait le sien, et le
 * joueur qui voulait en designer un autre devait taper un chemin absolu dans un
 * champ de texte -- en sachant lequel, ce que personne ne sait. Quand le
 * telechargement echouait (antivirus, disque plein, reseau d'entreprise), il n'y
 * avait aucune porte de sortie: pas de Java, pas de jeu, alors que la machine en
 * portait souvent trois.
 *
 * <h2>On interroge le binaire, on ne lit pas son chemin</h2>
 *
 * <p>Un dossier nomme `jre-17` peut contenir n'importe quoi, et `java` dans le
 * PATH peut etre un lanceur de distribution qui ne demarre rien. Chaque
 * candidat est donc execute: {@code -XshowSettings:properties -version} imprime
 * la version, le vendeur et l'architecture reels. C'est aussi ce qui elimine
 * sans cas particulier les chemins morts et les scripts qui portent le nom.
 *
 * <p>L'architecture compte autant que la version: un Java 32 bits ne lance pas
 * Minecraft moderne, et sur un Mac Apple Silicon un Java x86 tourne sous
 * emulation, donc lentement. Les deux se voient ici et nulle part ailleurs.
 */

/** Un Java trouve et verifie. */
export interface JavaTrouve {
  /** Le binaire a lancer. */
  chemin: string;
  /** Majeure reelle: 8, 17, 21, 25... */
  major: number;
  /** Version complete telle que la JVM l'annonce. */
  version: string;
  vendeur: string;
  /** `amd64`, `aarch64`, `x86`... tel que la JVM le declare. */
  arch: string;
  /** D'ou il sort, pour que le joueur reconnaisse le sien. */
  origine: string;
}

/** Le nom du binaire sur cette plateforme. */
function nomBinaire(): string {
  return process.platform === "win32" ? "java.exe" : "java";
}

/**
 * La majeure, depuis la chaine de version de la JVM.
 *
 * <p>Deux formes coexistent depuis vingt ans: `1.8.0_412` pour Java 8 et avant,
 * `21.0.5` depuis Java 9. Prendre le premier nombre donnerait 1 pour les
 * anciennes.
 */
export function majorDepuisVersion(version: string): number {
  const propre = version.trim();
  const ancienne = /^1\.(\d+)/.exec(propre);
  if (ancienne) {
    return Number(ancienne[1]);
  }
  const moderne = /^(\d+)/.exec(propre);
  return moderne ? Number(moderne[1]) : 0;
}

/**
 * Interroge un binaire Java et rend ce qu'il declare, ou null.
 *
 * <p>Sert aussi a valider le chemin que le joueur saisit lui-meme: lui dire
 * « ce fichier n'est pas un Java » au moment ou il le choisit vaut mieux que de
 * le lui apprendre a l'echec du lancement.
 */
export async function sondeJava(
  binaire: string,
  origine = "choisi a la main",
): Promise<JavaTrouve | null> {
  let sortie: string;
  try {
    // Les proprietes partent sur la sortie d'erreur, comme `-version`.
    const resultat = await execFileAsync(
      binaire,
      ["-XshowSettings:properties", "-version"],
      // Un binaire casse ou un disque reseau endormi ne doit pas figer la
      // detection: cinq secondes, puis on passe au suivant.
      { timeout: 5000, windowsHide: true },
    );
    sortie = `${resultat.stdout}${resultat.stderr}`;
  } catch (err) {
    // execFile rejette aussi quand le programme ecrit beaucoup sur stderr avec
    // un code de sortie non nul; on tente quand meme de lire ce qu'il a dit.
    const avecSortie = err as { stdout?: string; stderr?: string };
    sortie = `${avecSortie?.stdout ?? ""}${avecSortie?.stderr ?? ""}`;
    if (!sortie.includes("java.version")) {
      return null;
    }
  }

  const propriete = (nom: string): string =>
    new RegExp(`^\\s*${nom}\\s*=\\s*(.+)$`, "m").exec(sortie)?.[1]?.trim() ?? "";

  const version = propriete("java.version");
  if (!version) {
    return null;
  }

  const major = majorDepuisVersion(version);
  if (major <= 0) {
    return null;
  }

  return {
    chemin: binaire,
    major,
    version,
    vendeur: propriete("java.vendor") || "inconnu",
    arch: propriete("os.arch") || "inconnu",
    origine,
  };
}

/** Un candidat avant verification: un chemin et d'ou il vient. */
interface Candidat {
  chemin: string;
  origine: string;
}

/** `<home>/bin/java`, la forme de tous les repertoires d'installation. */
function binaireDe(javaHome: string): string {
  return path.join(javaHome, "bin", nomBinaire());
}

/** Les sous-dossiers directs d'un repertoire, ou rien s'il n'existe pas. */
async function sousDossiers(racine: string): Promise<string[]> {
  try {
    const entrees = await fs.readdir(racine, { withFileTypes: true });
    return entrees
      .filter((entree) => entree.isDirectory())
      .map((entree) => path.join(racine, entree.name));
  } catch {
    return [];
  }
}

/**
 * Les runtimes du launcher officiel de Minecraft.
 *
 * <p>C'est la source la plus utile de toutes, et celle qu'on oublie: presque
 * tout joueur a deja le launcher Mojang, qui installe lui-meme un Java par
 * grande version du jeu. L'arborescence est
 * `runtime/<nom>/<plateforme>/<nom>/bin/java`, avec parfois un `jre.bundle` de
 * plus sur macOS -- d'ou le parcours en profondeur plutot qu'un chemin ecrit en
 * dur, qui ne tiendrait pas d'une version a l'autre.
 */
async function runtimesMojang(racine: string): Promise<Candidat[]> {
  const trouves: Candidat[] = [];

  async function descends(dossier: string, profondeur: number): Promise<void> {
    if (profondeur > 5) {
      return;
    }
    const binaire = path.join(dossier, "bin", nomBinaire());
    try {
      await fs.access(binaire);
      trouves.push({ chemin: binaire, origine: "launcher Minecraft" });
      return;
    } catch {
      // Pas ici: on continue a descendre.
    }
    for (const enfant of await sousDossiers(dossier)) {
      await descends(enfant, profondeur + 1);
    }
  }

  await descends(racine, 0);
  return trouves;
}

/** Les endroits ou chercher, selon le systeme. */
async function candidats(): Promise<Candidat[]> {
  const liste: Candidat[] = [];
  const home = os.homedir();

  // Ce que le launcher a telecharge lui-meme: `jre-21`, `jre-17`, a cote des
  // autres donnees. C'est le Java qu'il utilise par defaut, et le voir dans la
  // liste evite de croire qu'il n'y en a aucun.
  for (const dossier of await sousDossiers(paranoiaDataDir())) {
    if (/^jre-\d+$/.test(path.basename(dossier))) {
      liste.push({ chemin: binaireDe(dossier), origine: "telecharge par Paranoia" });
    }
  }

  const javaHome = process.env.JAVA_HOME?.trim();
  if (javaHome) {
    liste.push({ chemin: binaireDe(javaHome), origine: "JAVA_HOME" });
  }

  // Le PATH, dossier par dossier: `which` n'existe pas partout et ne rend que
  // le premier, alors que plusieurs Java y cohabitent souvent.
  const separateur = process.platform === "win32" ? ";" : ":";
  for (const dossier of (process.env.PATH ?? "").split(separateur)) {
    if (dossier.trim()) {
      liste.push({ chemin: path.join(dossier.trim(), nomBinaire()), origine: "PATH" });
    }
  }

  if (process.platform === "win32") {
    const programFiles = [
      process.env.ProgramFiles ?? "C:\\Program Files",
      process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
      path.join(process.env.LOCALAPPDATA ?? path.join(home, "AppData", "Local"), "Programs"),
    ];
    const editeurs = [
      "Java",
      "Eclipse Adoptium",
      "Eclipse Foundation",
      "AdoptOpenJDK",
      "Microsoft",
      "Amazon Corretto",
      "Zulu",
      "BellSoft",
      "RedHat",
    ];
    for (const racine of programFiles) {
      for (const editeur of editeurs) {
        for (const dossier of await sousDossiers(path.join(racine, editeur))) {
          liste.push({ chemin: binaireDe(dossier), origine: path.basename(racine) + " / " + editeur });
        }
      }
    }

    liste.push(
      ...(await runtimesMojang(
        path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), ".minecraft", "runtime"),
      )),
    );
    liste.push(
      ...(await runtimesMojang(
        path.join(process.env.ProgramFiles ?? "C:\\Program Files", "Minecraft Launcher", "runtime"),
      )),
    );
  }

  if (process.platform === "darwin") {
    for (const dossier of await sousDossiers("/Library/Java/JavaVirtualMachines")) {
      liste.push({
        chemin: binaireDe(path.join(dossier, "Contents", "Home")),
        origine: "systeme",
      });
    }
    for (const dossier of await sousDossiers(
      path.join(home, "Library", "Java", "JavaVirtualMachines"),
    )) {
      liste.push({
        chemin: binaireDe(path.join(dossier, "Contents", "Home")),
        origine: "utilisateur",
      });
    }
    liste.push(
      ...(await runtimesMojang(
        path.join(home, "Library", "Application Support", "minecraft", "runtime"),
      )),
    );
  }

  if (process.platform === "linux") {
    for (const racine of ["/usr/lib/jvm", "/usr/java", "/opt/java", "/opt"]) {
      for (const dossier of await sousDossiers(racine)) {
        liste.push({ chemin: binaireDe(dossier), origine: racine });
      }
    }
    for (const dossier of await sousDossiers(
      path.join(home, ".sdkman", "candidates", "java"),
    )) {
      liste.push({ chemin: binaireDe(dossier), origine: "SDKMAN" });
    }
    liste.push(
      ...(await runtimesMojang(path.join(home, ".minecraft", "runtime"))),
    );
  }

  return liste;
}

/**
 * Tous les Java utilisables de la machine, du plus recent au plus ancien.
 *
 * <p>Ne leve jamais: une detection qui echoue doit laisser le launcher
 * telecharger le sien comme avant, pas l'empecher de jouer.
 */
export async function detecteJava(): Promise<JavaTrouve[]> {
  let liste: Candidat[];
  try {
    liste = await candidats();
  } catch {
    return [];
  }

  // Deux chemins peuvent designer le meme binaire -- JAVA_HOME et le PATH le
  // font presque toujours, et sur macOS les liens de /usr/bin aussi. On
  // dedoublonne sur le chemin reel avant de sonder, pour ne pas lancer deux
  // fois le meme programme.
  const vus = new Set<string>();
  const aSonder: Candidat[] = [];
  for (const candidat of liste) {
    let reel: string;
    try {
      reel = await fs.realpath(candidat.chemin);
    } catch {
      continue;
    }
    const cle = process.platform === "win32" ? reel.toLowerCase() : reel;
    if (vus.has(cle)) {
      continue;
    }
    vus.add(cle);
    aSonder.push({ ...candidat, chemin: candidat.chemin });
  }

  const sondes = await Promise.all(
    aSonder.map((candidat) =>
      sondeJava(candidat.chemin, candidat.origine).catch(() => null),
    ),
  );

  return sondes
    .filter((java): java is JavaTrouve => java !== null)
    .sort((a, b) => b.major - a.major || a.chemin.localeCompare(b.chemin));
}

/**
 * Le meilleur Java deja installe pour cette majeure, ou null.
 *
 * <p>Majeure exacte et non « au moins »: Minecraft refuse de demarrer sur une
 * majeure plus ancienne que celle qu'il demande, et une plus recente casse
 * regulierement les mods -- Fabric annonce la version qu'il supporte, pas
 * davantage.
 */
export async function javaInstallePour(major: number): Promise<JavaTrouve | null> {
  const tous = await detecteJava();
  return tous.find((java) => java.major === major) ?? null;
}

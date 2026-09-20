#!/usr/bin/env node
/**
 * Verifie que tout appel de methode sans recepteur existe bien.
 *
 * Pourquoi un controle a part plutot qu'une compilation: sans le jar de
 * Minecraft, `javac` renonce a analyser le corps d'une methode dont la
 * signature reference un type absent -- et la quasi-totalite des notres en
 * reference un. Un appel a une methode supprimee passe donc inapercu en local
 * et n'echoue qu'en CI, dix minutes plus tard. C'est arrive: trois accesseurs
 * retires par megarde pendant une refonte du menu.
 *
 * La regle est volontairement etroite: on ne regarde que les appels ecrits
 * sans point devant, et on les cherche dans la classe puis dans ses ancetres
 * du depot. Tout le reste -- appels qualifies, methodes heritees du JDK ou de
 * Minecraft -- sort du champ, faute de pouvoir les resoudre honnetement.
 */
import { readFileSync } from "node:fs";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const racine = path.join(here, "..", "src", "main", "java");

function fichiers(dossier) {
  return readdirSync(dossier).flatMap((nom) => {
    const complet = path.join(dossier, nom);
    return statSync(complet).isDirectory()
      ? fichiers(complet)
      : nom.endsWith(".java") ? [complet] : [];
  });
}

// Mots-cles suivis d'une parenthese: ce ne sont pas des appels de methode.
const MOTS_CLES = new Set([
  "if", "for", "while", "switch", "catch", "return", "new", "super", "this",
  "synchronized", "assert", "do", "else", "try", "case", "instanceof", "record",
]);

// Heritees du JDK ou de Minecraft, appelees sans recepteur depuis nos classes.
const HERITEES = new Set([
  "toString", "equals", "hashCode", "clone", "finalize", "getClass", "wait",
  "notify", "notifyAll", "values", "valueOf", "ordinal", "name", "compareTo",
]);

/**
 * Retire commentaires et chaines, en un seul passage.
 *
 * <p>Trois expressions regulieres enchainees ne suffisent pas: retirer les
 * commentaires « // » avant les chaines coupe un « https:// » au milieu d'un
 * litteral, ce qui laisse un guillemet orphelin et desapparie tout le reste du
 * fichier. C'etait la cause de deux faux positifs sur des messages de journal.
 *
 * <p>Les sauts de ligne sont conserves pour que les numeros restent justes.
 */
function sansCommentairesNiChaines(source) {
  let sortie = "";
  let etat = "code";
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    const suivant = source[i + 1];
    if (etat === "code") {
      if (c === "/" && suivant === "*") { etat = "bloc"; i++; sortie += "  "; continue; }
      if (c === "/" && suivant === "/") { etat = "ligne"; i++; sortie += "  "; continue; }
      if (c === '"' || c === "'") { etat = c; sortie += " "; continue; }
      sortie += c;
      continue;
    }
    if (etat === "bloc") {
      if (c === "*" && suivant === "/") { etat = "code"; i++; sortie += "  "; continue; }
      sortie += c === "\n" ? "\n" : " ";
      continue;
    }
    if (etat === "ligne") {
      if (c === "\n") { etat = "code"; sortie += "\n"; continue; }
      sortie += " ";
      continue;
    }
    // Dans une chaine ou un caractere: l'echappement avale le signe suivant.
    if (c === "\\") { i++; sortie += "  "; continue; }
    if (c === etat) { etat = "code"; sortie += " "; continue; }
    sortie += c === "\n" ? "\n" : " ";
  }
  return sortie;
}

const declarations = new Map();
const parents = new Map();
const tous = fichiers(racine);

for (const fichier of tous) {
  const source = readFileSync(fichier, "utf8");
  const classe = path.basename(fichier, ".java");

  const noms = new Set();
  for (const m of source.matchAll(
    /(?:^|\n)\s*(?:@\w+\s*)*(?:public|private|protected|static|final|abstract|synchronized|default|native|\s)*[\w<>\[\],.?\s]+\s+(\w+)\s*\([^)]*\)\s*(?:throws [\w,.\s]+)?[{;]/g)) {
    noms.add(m[1]);
  }
  // Les records declarent leurs accesseurs par leurs composants.
  for (const m of source.matchAll(/\brecord\s+\w+\s*\(([^)]*)\)/g)) {
    for (const part of m[1].split(",")) {
      const mot = part.trim().split(/\s+/).pop();
      if (mot) noms.add(mot);
    }
  }
  declarations.set(classe, noms);

  const herite = /\b(?:class|interface|enum)\s+\w+(?:<[^>]*>)?\s+extends\s+(\w+)/.exec(source);
  if (herite) parents.set(classe, herite[1]);
}

function connue(classe, nom, vus = new Set()) {
  if (!classe || vus.has(classe)) return false;
  vus.add(classe);
  const noms = declarations.get(classe);
  if (!noms) return true;             // ancetre hors du depot: on ne juge pas
  if (noms.has(nom)) return true;
  return connue(parents.get(classe), nom, vus);
}

const manquants = [];
for (const fichier of tous) {
  const source = sansCommentairesNiChaines(readFileSync(fichier, "utf8"));
  const classe = path.basename(fichier, ".java");

  source.split("\n").forEach((ligne, index) => {
    for (const m of ligne.matchAll(/(^|[^\w.$)\]])(\w+)\s*\(/g)) {
      const nom = m[2];
      if (MOTS_CLES.has(nom) || HERITEES.has(nom)) continue;
      if (/^[A-Z]/.test(nom)) continue;               // constructeur ou cast
      if (connue(classe, nom)) continue;
      manquants.push(
        `${path.relative(racine, fichier)}:${index + 1}  ${nom}() n'existe pas dans ${classe} ni ses ancetres`);
    }
  });
}

if (manquants.length > 0) {
  console.error("Appels sans recepteur qui ne resolvent nulle part:\n");
  for (const ligne of manquants) console.error(`  ${ligne}`);
  console.error("\nSoit la methode a ete supprimee, soit l'appel est mal orthographie.");
  process.exit(1);
}

console.log(`Appels verifies: ${tous.length} fichiers, aucun appel orphelin.`);

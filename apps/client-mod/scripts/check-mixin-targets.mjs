// Verifie que chaque cible d'injection existe vraiment sur la classe visee.
//
// Une injection dont la cible n'existe pas ne se voit ni a la compilation ni au
// remappage: javac ne lit pas les chaines de caracteres, et loom se contente de
// traduire les noms qu'il connait. La decouverte se fait au demarrage du jeu,
// et avec `injectors.defaultRequire: 1` elle est fatale.
//
// C'est exactement ce qui est arrive avec `onDisconnected`: la methode est
// heritee de ClientCommonNetworkHandler, donc absente de
// ClientPlayNetworkHandler, et le jeu plantait au chargement chez les joueurs
// alors que la CI etait verte.
//
// On lit donc les classes reelles de chaque version, dans les jars remappes par
// loom, avec javap.
//
// Usage: node scripts/check-mixin-targets.mjs
// (apres `gradle writeCompileClasspath`, qui expose le classpath de loom)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

/** Cibles qu'on ne sait pas verifier: on les signale sans faire echouer. */
const UNCHECKABLE = "cible pleinement qualifiee (Lowner;name)";

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

function collectImports(source) {
  const imports = new Map();
  for (const [, fqcn] of source.matchAll(/^\s*import\s+(?:static\s+)?([\w.$]+)\s*;/gm)) {
    imports.set(fqcn.slice(fqcn.lastIndexOf(".") + 1), fqcn);
  }
  return imports;
}

function resolveClass(simpleName, imports, file) {
  if (simpleName.includes(".")) {
    return simpleName;
  }
  const fqcn = imports.get(simpleName);
  if (!fqcn) {
    throw new Error(`${path.basename(file)}: @Mixin(${simpleName}.class) sans import correspondant`);
  }
  return fqcn;
}

/** Noms de methodes cibles d'un @Inject / @Redirect / @ModifyVariable... */
function collectTargets(source) {
  const targets = [];
  for (const [, raw] of source.matchAll(/method\s*=\s*(\{[^}]*\}|"(?:[^"\\]|\\.)*")/g)) {
    for (const [, value] of raw.matchAll(/"((?:[^"\\]|\\.)*)"/g)) {
      targets.push(value);
    }
  }
  return targets;
}

function parseMixin(file) {
  const source = stripComments(fs.readFileSync(file, "utf8"));
  const imports = collectImports(source);

  const mixin = /@Mixin\s*\(([^)]*)\)/.exec(source);
  if (!mixin) {
    return null;
  }

  const classes = [...mixin[1].matchAll(/([\w.$]+)\s*\.\s*class/g)]
    .map((match) => resolveClass(match[1], imports, file));

  return { file, classes, targets: collectTargets(source) };
}

/**
 * Methodes declarees par une classe, telles que le jeu les porte reellement.
 *
 * <p>javap ne liste que les methodes declarees, jamais les heritees: c'est
 * precisement la distinction qui nous interesse, mixin ne pouvant injecter que
 * dans le bytecode de la classe qu'il transforme.
 */
function inspect(fqcn, classpath) {
  let output;
  try {
    output = execFileSync("javap", ["-p", "-cp", classpath, fqcn], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 32 * 1024 * 1024,
    });
  } catch {
    return null;
  }

  const simpleName = fqcn.slice(fqcn.lastIndexOf(".") + 1);
  const methods = new Set();
  let superclass = null;

  for (const line of output.split("\n")) {
    const declaration = /\b(?:class|interface)\s+[\w.$]+/.exec(line);
    if (declaration) {
      superclass = /\bextends\s+([\w.$]+)/.exec(line)?.[1] ?? null;
      continue;
    }

    const name = /([A-Za-z_$][\w$]*)\s*\(/.exec(line)?.[1];
    if (name) {
      methods.add(name === simpleName ? "<init>" : name);
    }
  }

  return { methods, superclass };
}

/** Ou la methode est-elle reellement declaree ? Sert au message d'erreur. */
function findInAncestors(superclass, method, classpath) {
  let current = superclass;
  for (let depth = 0; current && depth < 8; depth += 1) {
    const parent = inspect(current, classpath);
    if (!parent) {
      return null;
    }
    if (parent.methods.has(method)) {
      return current;
    }
    current = parent.superclass;
  }
  return null;
}

function mixinFiles(version) {
  const dirs = [
    path.join(root, "src/main/java/gg/paranoia/client/mixin"),
    path.join(root, "versions", version, "src/main/java/gg/paranoia/client/mixin"),
  ];

  return dirs
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) =>
      fs.readdirSync(dir)
        .filter((name) => name.endsWith(".java"))
        .map((name) => path.join(dir, name)));
}

/**
 * Un mixin absent de la configuration n'est jamais applique, et un mixin
 * configure mais supprime fait echouer le chargement du mod. Ni l'un ni l'autre
 * ne se voit a la compilation.
 */
function checkConfig(version, files, problems) {
  const config = path.join(root, "versions", version, "src/main/resources/paranoia_client.mixins.json");
  if (!fs.existsSync(config)) {
    problems.push(`${version}: paranoia_client.mixins.json introuvable`);
    return;
  }

  const declared = new Set(JSON.parse(fs.readFileSync(config, "utf8")).client ?? []);
  const present = new Set(files.map((file) => path.basename(file, ".java")));

  for (const name of present) {
    if (!declared.has(name)) {
      problems.push(`${version}: ${name} n'est pas declare dans paranoia_client.mixins.json (il ne serait jamais applique)`);
    }
  }
  for (const name of declared) {
    if (!present.has(name)) {
      problems.push(`${version}: paranoia_client.mixins.json declare ${name}, dont la source n'existe pas`);
    }
  }
}

function checkVersion(version, classpath) {
  const problems = [];
  const files = mixinFiles(version);
  checkConfig(version, files, problems);

  let checked = 0;
  for (const file of files) {
    const mixin = parseMixin(file);
    if (!mixin) {
      problems.push(`${path.basename(file)}: aucune annotation @Mixin`);
      continue;
    }

    for (const fqcn of mixin.classes) {
      const target = inspect(fqcn, classpath);
      if (!target) {
        problems.push(`${version}: classe ciblee introuvable dans le jar remappe: ${fqcn}`);
        continue;
      }

      for (const raw of mixin.targets) {
        if (raw.startsWith("L") && raw.includes(";")) {
          console.log(`  ${version} ${path.basename(file)}: ${raw} non verifie (${UNCHECKABLE})`);
          continue;
        }

        const name = raw.split("(")[0];
        checked += 1;
        if (target.methods.has(name)) {
          continue;
        }

        const owner = findInAncestors(target.superclass, name, classpath);
        const hint = owner
          ? ` -- elle est declaree sur ${owner}, dont ${fqcn} herite: mixin ne peut pas s'y injecter depuis la sous-classe`
          : " -- aucune classe parente ne la declare non plus (renommee ou supprimee dans cette version ?)";
        problems.push(`${version}: ${path.basename(file)} injecte dans ${name}, absente de ${fqcn}${hint}`);
      }
    }
  }

  return { problems, checked };
}

function main() {
  const versionsDir = path.join(root, "versions");
  const versions = fs.readdirSync(versionsDir)
    .filter((name) => fs.existsSync(path.join(versionsDir, name, "build/compile-classpath.txt")))
    .sort();

  if (versions.length === 0) {
    throw new Error(
      "aucun classpath disponible: lancer `gradle writeCompileClasspath` avant ce script");
  }

  const problems = [];
  for (const version of versions) {
    const classpath = fs
      .readFileSync(path.join(versionsDir, version, "build/compile-classpath.txt"), "utf8")
      .trim();

    const result = checkVersion(version, classpath);
    problems.push(...result.problems);
    console.log(`${version}: ${result.checked} cible(s) verifiee(s), ${result.problems.length} probleme(s)`);

    // Une verification qui ne verifie rien passerait sans bruit et laisserait
    // repartir en release le bug meme qu'elle est censee attraper. Les sources
    // partagees portent des injections: n'en trouver aucune veut dire que
    // l'analyse est cassee, pas que tout va bien.
    if (result.checked === 0) {
      problems.push(`${version}: aucune cible d'injection trouvee dans les sources -- l'analyse des mixins est cassee`);
    }
  }

  if (problems.length > 0) {
    for (const problem of problems) {
      console.error(`::error::${problem}`);
    }
    process.exit(1);
  }

  console.log("Toutes les cibles d'injection existent sur les classes visees.");
}

main();

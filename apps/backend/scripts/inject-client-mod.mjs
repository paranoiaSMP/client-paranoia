// Inscrit le mod Paranoia dans le catalogue d'installation, avec son empreinte
// reelle et l'URL de la release en cours.
//
// Le catalogue est un fichier statique embarque dans le backend, mais le jar
// change a chaque build: ecrire son sha256 a la main garantissait une empreinte
// perimee des la release suivante, donc un telechargement refuse chez le joueur.
// La CI appelle donc ce script avant d'empaqueter le backend.
//
// Usage: node scripts/inject-client-mod.mjs <dossier-des-jars> <tag> <repo>
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const backendRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const catalogPath = path.join(
  backendRoot, "..", "..", "examples", "remote-config", "install-catalog.json");

async function sha256(filePath) {
  const hash = crypto.createHash("sha256");
  hash.update(await fs.readFile(filePath));
  return hash.digest("hex");
}

/**
 * Retrouve la version de Minecraft d'un jar a partir de son nom.
 *
 * <p>Les jars sont nommes paranoia-client-<mod>+<minecraft>.jar par Gradle,
 * la version du sous-projet valant "<mod_version>+<nom du sous-projet>".
 */
function minecraftVersionOf(fileName) {
  const match = /\+([0-9][0-9.]*)\.jar$/.exec(fileName);
  return match ? match[1] : null;
}

async function collectJars(directory) {
  const jars = new Map();

  async function walk(current) {
    for (const entry of await fs.readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.name.endsWith(".jar") || entry.name.endsWith("-sources.jar")) {
        continue;
      }
      const version = minecraftVersionOf(entry.name);
      if (version) {
        jars.set(version, full);
      }
    }
  }

  await walk(directory);
  return jars;
}

async function main() {
  const [directory, tag, repository] = process.argv.slice(2);
  if (!directory || !tag || !repository) {
    throw new Error("usage: inject-client-mod.mjs <dossier-des-jars> <tag> <owner/repo>");
  }

  const jars = await collectJars(directory);
  if (jars.size === 0) {
    throw new Error(`aucun jar de mod trouve dans ${directory}`);
  }

  const catalog = JSON.parse(await fs.readFile(catalogPath, "utf8"));
  const described = new Map();

  for (const [minecraftVersion, jarPath] of jars) {
    const fileName = path.basename(jarPath);
    described.set(minecraftVersion, {
      fileName,
      downloadUrl:
        `https://github.com/${repository}/releases/download/${tag}/${fileName}`,
      sha256: await sha256(jarPath),
      size: (await fs.stat(jarPath)).size,
    });
  }

  let injected = 0;
  let skipped = 0;

  for (const entry of catalog.entries) {
    const clientMod = described.get(entry.minecraftVersion);
    if (clientMod) {
      entry.clientMod = clientMod;
      injected++;
    } else {
      // Version de Minecraft proposee par le launcher mais pour laquelle le mod
      // n'est pas compile: on retire toute reference perimee plutot que de
      // laisser pointer vers un jar d'une autre version.
      delete entry.clientMod;
      skipped++;
    }
  }

  await fs.writeFile(catalogPath, JSON.stringify(catalog, null, 2) + "\n");

  console.log(`Mod client injecte dans ${injected} entrees, ${skipped} sans mod.`);
  for (const [version, clientMod] of described) {
    console.log(`  ${version}: ${clientMod.fileName} (${clientMod.sha256.slice(0, 12)}...)`);
  }
}

main().catch((err) => {
  console.error(`Injection du mod client impossible: ${err.message}`);
  process.exit(1);
});

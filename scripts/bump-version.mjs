// Met la version du launcher a jour partout d'un coup.
//
// Elle vit dans cinq fichiers, et ils avaient fini par se contredire:
// tauri.conf.json disait 0.3.4, package.json du launcher 0.3.0, Cargo.toml
// 0.3.0. L'installeur publie sous le tag v0.3.6 s'appelait donc
// "Paranoia Client_0.3.4_x64-setup.exe", et le launcher installe annoncait une
// version differente de celle de latest.json: il proposait en boucle une mise a
// jour vers ce qu'il avait deja.
//
// Celle qui compte pour les mises a jour est tauri.conf.json: c'est elle que
// l'application annonce. Les autres doivent suivre.
//
// Usage: node scripts/bump-version.mjs 0.4.0
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const JSON_FILES = [
  "apps/launcher/src-tauri/tauri.conf.json",
  "apps/launcher/package.json",
  "package.json",
];

async function bumpJson(relative, version) {
  const file = path.join(root, relative);
  const raw = await fs.readFile(file, "utf8");
  const data = JSON.parse(raw);
  const before = data.version;
  data.version = version;
  // Indentation a deux espaces comme le reste du depot, et saut de ligne final.
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n");
  return before;
}

async function bumpCargoToml(version) {
  const file = path.join(root, "apps/launcher/src-tauri/Cargo.toml");
  const raw = await fs.readFile(file, "utf8");
  const before = /^version = "([^"]+)"/m.exec(raw)?.[1];
  const updated = raw.replace(/^version = "[^"]+"/m, `version = "${version}"`);
  if (updated === raw) {
    throw new Error("ligne version introuvable dans Cargo.toml");
  }
  await fs.writeFile(file, updated);
  return before;
}

/**
 * Cargo.lock epingle aussi la version du paquet.
 *
 * <p>La laisser en arriere ferait echouer un build `--locked`, et brouillerait
 * la lecture du diff a chaque release.
 */
async function bumpCargoLock(version) {
  const file = path.join(root, "apps/launcher/src-tauri/Cargo.lock");
  let raw;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return null;
  }

  const pattern = /(name = "paranoia-launcher"\nversion = ")([^"]+)(")/;
  const found = pattern.exec(raw);
  if (!found) {
    return null;
  }

  await fs.writeFile(file, raw.replace(pattern, `$1${version}$3`));
  return found[2];
}

async function main() {
  const version = process.argv[2];
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error("usage: node scripts/bump-version.mjs <x.y.z>");
  }

  for (const relative of JSON_FILES) {
    const before = await bumpJson(relative, version);
    console.log(`  ${relative}: ${before} -> ${version}`);
  }

  console.log(`  apps/launcher/src-tauri/Cargo.toml: ${await bumpCargoToml(version)} -> ${version}`);

  const lockBefore = await bumpCargoLock(version);
  if (lockBefore) {
    console.log(`  apps/launcher/src-tauri/Cargo.lock: ${lockBefore} -> ${version}`);
  }

  console.log(`\nVersion ${version}. Ensuite:`);
  console.log(`  git commit -am "chore: release v${version}"`);
  console.log(`  git tag v${version} && git push origin main v${version}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

// Resout les versions de yarn, du loader Fabric et de Fabric API pour chaque
// version de Minecraft ciblee, et les ecrit dans versions/<mc>/versions.properties.
//
// Ces numeros bougent a chaque publication amont; les ecrire a la main dans le
// depot condamne le build a casser des qu'une version sort. La CI les resout
// avant de compiler, et affiche ce qu'elle a retenu pour qu'on puisse les figer
// si un jour on veut un build reproductible a l'identique.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const modRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

async function getJson(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "paranoiaSMP/client-paranoia (build)" },
  });
  if (!response.ok) {
    throw new Error(`${url} a repondu ${response.status}`);
  }
  return response.json();
}

/** Derniere version de yarn publiee pour cette version de Minecraft. */
async function resolveYarn(minecraftVersion) {
  const builds = await getJson(
    `https://meta.fabricmc.net/v2/versions/yarn/${minecraftVersion}`,
  );
  if (!Array.isArray(builds) || builds.length === 0) {
    throw new Error(`aucun mapping yarn pour ${minecraftVersion}`);
  }
  // L'API renvoie les builds du plus recent au plus ancien.
  return builds[0].version;
}

/** Dernier loader stable annonce pour cette version de Minecraft. */
async function resolveLoader(minecraftVersion) {
  const entries = await getJson(
    `https://meta.fabricmc.net/v2/versions/loader/${minecraftVersion}`,
  );
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`aucun loader Fabric pour ${minecraftVersion}`);
  }
  const stable = entries.find((entry) => entry.loader?.stable);
  return (stable ?? entries[0]).loader.version;
}

/**
 * Fabric API n'est pas publie sur meta.fabricmc.net: on prend la derniere
 * version Modrinth compatible, exactement comme le fait deja le launcher pour
 * les dependances de mods.
 */
async function resolveFabricApi(minecraftVersion) {
  const query = new URLSearchParams({
    game_versions: JSON.stringify([minecraftVersion]),
    loaders: JSON.stringify(["fabric"]),
  });
  const versions = await getJson(
    `https://api.modrinth.com/v2/project/fabric-api/version?${query}`,
  );
  if (!Array.isArray(versions) || versions.length === 0) {
    throw new Error(`aucune version de Fabric API pour ${minecraftVersion}`);
  }
  const sorted = [...versions].sort(
    (a, b) => Date.parse(b.date_published) - Date.parse(a.date_published),
  );
  return sorted[0].version_number;
}

async function targets() {
  const versionsDir = path.join(modRoot, "versions");
  const entries = await fs.readdir(versionsDir, { withFileTypes: true });
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
}

async function main() {
  const minecraftVersions = await targets();
  if (minecraftVersions.length === 0) {
    throw new Error("aucun dossier dans versions/");
  }

  for (const minecraftVersion of minecraftVersions) {
    const [yarn, loader, fabricApi] = await Promise.all([
      resolveYarn(minecraftVersion),
      resolveLoader(minecraftVersion),
      resolveFabricApi(minecraftVersion),
    ]);

    const contents = [
      "# Genere par scripts/resolve-fabric-versions.mjs -- ne pas editer a la main.",
      `minecraft_version=${minecraftVersion}`,
      `yarn_mappings=${yarn}`,
      `loader_version=${loader}`,
      `fabric_api_version=${fabricApi}`,
      "",
    ].join("\n");

    await fs.writeFile(
      path.join(modRoot, "versions", minecraftVersion, "versions.properties"),
      contents,
      "utf8",
    );

    console.log(
      `${minecraftVersion}: yarn=${yarn} loader=${loader} fabric-api=${fabricApi}`,
    );
  }
}

main().catch((err) => {
  console.error(`Resolution des versions Fabric impossible: ${err.message}`);
  process.exit(1);
});

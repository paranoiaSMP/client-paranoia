import fs from "node:fs";
import path from "node:path";
import { paranoiaDataDir } from "../launcher/paths.js";

const VERSION_MANIFEST_URL =
  process.env.MINECRAFT_VERSION_MANIFEST_URL ??
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";

const CACHE_TTL_MS = 60 * 60 * 1000;

interface ManifestVersion {
  id: string;
  type: string;
  releaseTime: string;
}

interface Manifest {
  latest?: { release?: string; snapshot?: string };
  versions?: ManifestVersion[];
}

/** Ce qu'on retient du manifeste de Mojang. */
interface Catalogue {
  /** Versions publiees, de la plus recente a la plus ancienne. */
  releases: string[];
  /** La derniere snapshot, ou null s'il n'y en a pas de plus recente. */
  snapshot: string | null;
  /** Type reel de chaque identifiant, pour ne pas avoir a le deviner. */
  types: Map<string, string>;
}

let cache: { catalogue: Catalogue; fetchedAt: number } | null = null;

/**
 * Last list successfully fetched, kept on disk.
 *
 * Without it, a player who has been offline since install falls back to the
 * versions frozen in the bundled config, which age with every Minecraft
 * release. With it, the newest list ever seen survives restarts.
 */
const CACHE_FILE = () => path.join(paranoiaDataDir(), "minecraft-versions.json");

function readDiskCache(): { versions: string[]; snapshot: string | null } | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(CACHE_FILE(), "utf-8"));
    if (!Array.isArray(parsed?.versions) || parsed.versions.length === 0) {
      return null;
    }
    // `snapshot` est apparu apres: un cache ecrit par une version precedente du
    // launcher n'en a pas, et c'est une absence, pas une erreur.
    return {
      versions: parsed.versions as string[],
      snapshot: typeof parsed.snapshot === "string" ? parsed.snapshot : null,
    };
  } catch {
    return null;
  }
}

function writeDiskCache(versions: string[], snapshot: string | null): void {
  try {
    const file = CACHE_FILE();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      JSON.stringify({ versions, snapshot, updatedAt: new Date().toISOString() }),
      "utf-8",
    );
  } catch (err) {
    // Un cache non ecrit n'empeche rien: on repartira du reseau.
    console.warn("[catalog] cache des versions non ecrit:", err);
  }
}

/**
 * La derniere snapshot, si elle est bien plus recente que la derniere release.
 *
 * <p>Mojang met `latest.snapshot` a l'identifiant de la release le jour ou une
 * release sort: les deux champs sont alors egaux. Proposer « derniere
 * snapshot » dans ce cas afficherait une release sous un nom qui n'est pas le
 * sien, et le joueur croirait essayer autre chose que ce qu'il joue deja.
 *
 * <p>On verifie donc aussi le type reel dans la liste, plutot que de se fier au
 * seul champ `latest`: c'est la liste qui fait foi sur ce qu'est une version.
 */
function derniereSnapshot(data: Manifest, types: Map<string, string>): string | null {
  const annoncee = data.latest?.snapshot;
  if (!annoncee || annoncee === data.latest?.release) {
    return null;
  }
  return types.get(annoncee) === "snapshot" ? annoncee : null;
}

async function fetchCatalogue(): Promise<Catalogue> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.catalogue;
  }

  const response = await fetch(VERSION_MANIFEST_URL, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`manifeste Mojang indisponible (${response.status})`);
  }

  const data = (await response.json()) as Manifest;
  const toutes = data.versions ?? [];

  const types = new Map(toutes.map((version) => [version.id, version.type]));

  const releases = toutes
    .filter((version) => version.type === "release")
    .sort((a, b) => Date.parse(b.releaseTime) - Date.parse(a.releaseTime))
    .map((version) => version.id);

  if (releases.length === 0) {
    throw new Error("manifeste Mojang vide");
  }

  const catalogue: Catalogue = {
    releases,
    snapshot: derniereSnapshot(data, types),
    types,
  };

  cache = { catalogue, fetchedAt: Date.now() };
  writeDiskCache(catalogue.releases, catalogue.snapshot);
  return catalogue;
}

/**
 * Live release list from Mojang, newest first.
 *
 * The supported versions used to be hardcoded in the remote config, so every
 * new Minecraft release meant shipping a new launcher. Snapshots are kept out
 * of this list on purpose: elles ne sont pas ce qu'on choisit pour jouer sur un
 * serveur, et la seule qui interesse -- la derniere -- est proposee a part par
 * {@link latestSnapshotOrNull}.
 */
export async function fetchMinecraftReleases(): Promise<string[]> {
  return (await fetchCatalogue()).releases;
}

/**
 * Same list, but never throws: falls back to whatever the bundled config
 * declares so the launcher still works offline.
 */
export async function minecraftReleasesOrFallback(
  fallback: string[],
): Promise<string[]> {
  try {
    return await fetchMinecraftReleases();
  } catch (err) {
    console.warn(
      "[catalog] liste des versions Mojang indisponible:",
      err instanceof Error ? err.message : err,
    );

    // La derniere liste connue vaut mieux que celle figee a la compilation.
    return readDiskCache()?.versions ?? fallback;
  }
}

/**
 * La derniere snapshot proposable, ou null.
 *
 * <p>Une seule, et pas la liste: un joueur qui veut essayer la prochaine
 * version veut la derniere, pas le choix parmi neuf cents. Les proposer toutes
 * noierait en plus les releases, qui sont ce qu'on lance pour jouer.
 *
 * <p>Ne leve jamais: une snapshot est un confort, et un manifeste injoignable
 * ne doit pas empecher de creer un profil. On retombe sur la derniere connue,
 * qui vaut mieux que rien tant qu'elle existe encore chez Mojang -- et si elle
 * n'existe plus, le lancement echouera clairement sur une version introuvable
 * plutot que silencieusement.
 */
export async function latestSnapshotOrNull(): Promise<string | null> {
  try {
    return (await fetchCatalogue()).snapshot;
  } catch (err) {
    console.warn(
      "[catalog] derniere snapshot indisponible:",
      err instanceof Error ? err.message : err,
    );
    return readDiskCache()?.snapshot ?? null;
  }
}

/**
 * Le type reel d'une version, tel que Mojang le declare.
 *
 * <p>Sert a la ligne de commande du jeu: `--versionType` y arrivait toujours
 * « release », snapshot comprise. Ce n'est pas anodin -- c'est ce que le jeu
 * affiche dans F3 et ce qu'il joint a un rapport de plantage, donc le premier
 * renseignement qu'on lit quand on cherche a comprendre un crash.
 *
 * <p>Rend « release » quand on ne sait pas: c'est le cas de la quasi-totalite
 * des versions, et c'est ce que le launcher envoyait de toute facon avant.
 */
export async function minecraftVersionType(
  minecraftVersion: string,
): Promise<string> {
  try {
    const catalogue = await fetchCatalogue();
    return catalogue.types.get(minecraftVersion) ?? "release";
  } catch {
    const disque = readDiskCache();
    if (disque?.snapshot === minecraftVersion) {
      return "snapshot";
    }
    return "release";
  }
}

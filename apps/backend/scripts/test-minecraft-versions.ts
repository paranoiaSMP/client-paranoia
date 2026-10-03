// Eprouve la liste des versions de Minecraft et la derniere snapshot, contre
// un manifeste Mojang servi en local.
//
// Pourquoi un banc pour quelques lignes de filtrage: ce code decide ce que le
// joueur peut choisir a la creation d'un profil, et ses deux defauts possibles
// sont silencieux. Une snapshot qui se glisse dans la liste des releases se
// retrouve en tete -- elle est par construction la plus recente -- donc elle
// devient la version proposee par defaut a quelqu'un qui veut juste jouer. Et
// une snapshot annoncee alors qu'il n'y en a pas de plus recente qu'une release
// affiche une release sous un nom qui n'est pas le sien.
//
// Aucun des deux ne fait echouer quoi que ce soit: le profil se cree, le jeu se
// lance, et c'est le joueur qui decouvre qu'il n'est pas sur la version qu'il
// croyait.
//
// Le manifeste est servi par un serveur local, donc aucun appel reseau: le banc
// tourne a chaque push, y compris quand piston-meta.mojang.com est injoignable.
//
// Usage: pnpm exec tsx scripts/test-minecraft-versions.ts

import fs from "node:fs";
import http from "node:http";
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

interface Entree {
  id: string;
  type: string;
  releaseTime: string;
}

interface Manifeste {
  latest: { release?: string; snapshot?: string };
  versions: Entree[];
}

function version(id: string, type: string, date: string): Entree {
  return { id, type, releaseTime: `${date}T00:00:00+00:00` };
}

/**
 * Un manifeste de la forme de celui de Mojang: une snapshot plus recente que
 * la derniere release, et des entrees volontairement dans le desordre.
 */
function manifesteOrdinaire(): Manifeste {
  return {
    latest: { release: "26.3", snapshot: "26.4-pre1" },
    versions: [
      version("26.4-pre1", "snapshot", "2026-10-01"),
      version("1.21.11", "release", "2026-08-20"),
      version("26.3", "release", "2026-09-28"),
      version("26w39a", "snapshot", "2026-09-24"),
      version("26.2", "release", "2026-09-10"),
      version("1.21.8", "release", "2026-06-02"),
    ],
  };
}

/** Le serveur local, et l'URL a donner au module. */
function sers(manifeste: unknown): Promise<{ url: string; ferme: () => void }> {
  const serveur = http.createServer((_req, res) => {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(manifeste));
  });
  return new Promise((resoudre) => {
    serveur.listen(0, "127.0.0.1", () => {
      const adresse = serveur.address();
      const port = typeof adresse === "object" && adresse ? adresse.port : 0;
      resoudre({
        url: `http://127.0.0.1:${port}/version_manifest_v2.json`,
        ferme: () => serveur.close(),
      });
    });
  });
}

/**
 * Charge le module a neuf, avec ses variables d'environnement.
 *
 * <p>L'URL du manifeste est lue au chargement du module, et le catalogue y est
 * garde une heure en memoire: sans un module neuf par scenario, le deuxieme
 * repondrait avec les donnees du premier. La chaine de requete suffit a l'ESM
 * pour en faire une autre instance.
 */
let compteur = 0;
async function charge(options: { manifestUrl: string; donnees: string }) {
  process.env.MINECRAFT_VERSION_MANIFEST_URL = options.manifestUrl;
  // paranoiaDataDir() lit XDG_DATA_HOME a chaque appel sur Linux: c'est par la
  // qu'on detourne le cache disque vers un dossier jetable.
  process.env.XDG_DATA_HOME = options.donnees;
  compteur++;
  return import(`../src/modules/catalog/minecraftVersions.js?essai=${compteur}`);
}

function dossierJetable(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "versions-"));
}

/** Un port ou personne n'ecoute: le refus est immediat, pas un delai d'attente. */
const INJOIGNABLE = "http://127.0.0.1:1/version_manifest_v2.json";

async function principal() {
  console.log("\n--- manifeste ordinaire");
  {
    const serveur = await sers(manifesteOrdinaire());
    const donnees = dossierJetable();
    const mod = await charge({ manifestUrl: serveur.url, donnees });

    const releases = await mod.minecraftReleasesOrFallback(["secours"]);
    const snapshot = await mod.latestSnapshotOrNull();

    verifie(
      releases.join(",") === "26.3,26.2,1.21.11,1.21.8",
      `les releases sortent de la plus recente a la plus ancienne (${releases.join(", ")})`,
    );
    verifie(
      !releases.includes("26.4-pre1") && !releases.includes("26w39a"),
      "aucune snapshot dans la liste des releases",
    );
    verifie(snapshot === "26.4-pre1", `derniere snapshot proposee (${snapshot})`);
    verifie(
      (await mod.minecraftVersionType("26.4-pre1")) === "snapshot",
      "le type d'une snapshot est « snapshot »",
    );
    verifie(
      (await mod.minecraftVersionType("26.3")) === "release",
      "le type d'une release est « release »",
    );
    verifie(
      (await mod.minecraftVersionType("1.4.7")) === "release",
      "une version inconnue est traitee comme une release",
    );
    serveur.ferme();
  }

  console.log("\n--- le jour d'une sortie: latest.snapshot vaut la release");
  {
    const manifeste = manifesteOrdinaire();
    manifeste.latest = { release: "26.3", snapshot: "26.3" };
    const serveur = await sers(manifeste);
    const mod = await charge({ manifestUrl: serveur.url, donnees: dossierJetable() });

    verifie(
      (await mod.latestSnapshotOrNull()) === null,
      "aucune snapshot proposee quand elle est la release elle-meme",
    );
    verifie(
      (await mod.minecraftReleasesOrFallback(["secours"]))[0] === "26.3",
      "la liste des releases n'en est pas affectee",
    );
    serveur.ferme();
  }

  console.log("\n--- latest.snapshot annonce une version typee release");
  {
    const manifeste = manifesteOrdinaire();
    // Incoherence que Mojang ne produit pas, mais qui coute une ligne a
    // refuser: la liste fait foi sur ce qu'est une version.
    manifeste.latest = { release: "26.2", snapshot: "26.3" };
    const serveur = await sers(manifeste);
    const mod = await charge({ manifestUrl: serveur.url, donnees: dossierJetable() });

    verifie(
      (await mod.latestSnapshotOrNull()) === null,
      "une release annoncee comme snapshot est refusee",
    );
    serveur.ferme();
  }

  console.log("\n--- hors ligne, avec le cache ecrit par un passage precedent");
  {
    const donnees = dossierJetable();
    const serveur = await sers(manifesteOrdinaire());
    const enLigne = await charge({ manifestUrl: serveur.url, donnees });
    await enLigne.minecraftReleasesOrFallback(["secours"]);
    serveur.ferme();

    const horsLigne = await charge({ manifestUrl: INJOIGNABLE, donnees });
    const releases = await horsLigne.minecraftReleasesOrFallback(["secours"]);
    const snapshot = await horsLigne.latestSnapshotOrNull();

    verifie(
      releases.join(",") === "26.3,26.2,1.21.11,1.21.8",
      "la derniere liste connue est rendue, et non celle figee a la compilation",
    );
    verifie(
      snapshot === "26.4-pre1",
      `la derniere snapshot connue survit aussi au redemarrage (${snapshot})`,
    );
    verifie(
      (await horsLigne.minecraftVersionType("26.4-pre1")) === "snapshot",
      "et son type reste connu hors ligne",
    );
  }

  console.log("\n--- hors ligne, sans cache");
  {
    const mod = await charge({ manifestUrl: INJOIGNABLE, donnees: dossierJetable() });
    const releases = await mod.minecraftReleasesOrFallback(["1.21.11", "1.21.8"]);

    verifie(
      releases.join(",") === "1.21.11,1.21.8",
      "on retombe sur la liste fournie par le catalogue embarque",
    );
    verifie(
      (await mod.latestSnapshotOrNull()) === null,
      "aucune snapshot proposee: mieux vaut rien qu'un identifiant invente",
    );
    verifie(
      (await mod.minecraftVersionType("1.21.11")) === "release",
      "le type reste « release » faute de mieux",
    );
  }

  console.log("\n--- manifeste sans aucune release");
  {
    const serveur = await sers({ latest: {}, versions: [version("26w40a", "snapshot", "2026-10-02")] });
    const mod = await charge({ manifestUrl: serveur.url, donnees: dossierJetable() });

    const releases = await mod.minecraftReleasesOrFallback(["1.21.11"]);
    verifie(
      releases.join(",") === "1.21.11",
      "un manifeste vide de releases ne vide pas la liste du launcher",
    );
    let leve = false;
    try {
      await mod.fetchMinecraftReleases();
    } catch {
      leve = true;
    }
    verifie(leve, "fetchMinecraftReleases echoue clairement plutot que de rendre une liste vide");
    serveur.ferme();
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

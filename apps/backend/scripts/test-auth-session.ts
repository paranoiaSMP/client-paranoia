// Eprouve le renouvellement de session contre un faux Microsoft servi en local.
//
// Ce que ce banc protege: ne pas avoir a se reconnecter.
//
// La chaine compte cinq appels reseau -- Microsoft, Xbox Live, XSTS, Minecraft,
// le profil -- et le code supprimait le compte enregistre des que l'un d'eux
// echouait, quelle que soit la raison. Un Wi-Fi pas encore associe au demarrage
// du launcher, un Xbox Live en panne trois secondes, un 500 passager: le joueur
// repassait par la fenetre Microsoft alors que son jeton de renouvellement
// etait parfaitement valide, et il n'y avait aucun moyen de le recuperer.
//
// La regle est donc: on n'oublie un compte que lorsque Microsoft refuse
// explicitement son jeton (`invalid_grant`). Tout le reste se retente.
//
// Aucun appel reseau: les quatre services sont servis par un serveur local, via
// les variables d'environnement que auth.microsoft.ts accepte pour cela.
//
// Usage: pnpm exec tsx scripts/test-auth-session.ts

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

/** Ce que le faux Microsoft doit repondre, scenario par scenario. */
interface Reglage {
  /** Codes HTTP a rendre sur /oauth20_token.srf, un par appel. 200 ensuite. */
  jeton?: Array<{ status: number; corps: string }>;
  /** Code HTTP a rendre sur Xbox Live. 200 par defaut. */
  xbl?: number;
}

interface Faux {
  base: string;
  appels: string[];
  ferme: () => void;
}

function sers(reglage: Reglage): Promise<Faux> {
  const appels: string[] = [];
  let jetonsServis = 0;

  const serveur = http.createServer((req, res) => {
    const chemin = (req.url ?? "").split("?")[0] ?? "";
    appels.push(chemin);

    const repond = (status: number, corps: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(typeof corps === "string" ? corps : JSON.stringify(corps));
    };

    // Les corps de requete sont lus et jetes: ce banc verifie le comportement
    // du launcher face aux reponses, pas la forme de ses envois.
    req.resume();

    if (chemin === "/oauth20_token.srf") {
      const prevu = reglage.jeton?.[jetonsServis++];
      if (prevu) {
        return repond(prevu.status, prevu.corps);
      }
      return repond(200, {
        access_token: "oauth-neuf",
        // Microsoft fait tourner ses jetons de renouvellement: celui-ci doit
        // se retrouver dans le fichier des comptes, sinon le renouvellement
        // suivant echouerait avec l'ancien.
        refresh_token: "refresh-tourne",
      });
    }

    if (chemin === "/user/authenticate") {
      if (reglage.xbl && reglage.xbl !== 200) {
        return repond(reglage.xbl, { erreur: "panne" });
      }
      return repond(200, {
        Token: "jeton-xbl",
        DisplayClaims: { xui: [{ uhs: "hash" }] },
      });
    }

    if (chemin === "/xsts/authorize") {
      return repond(200, {
        Token: "jeton-xsts",
        DisplayClaims: { xui: [{ uhs: "hash" }] },
      });
    }

    if (chemin === "/authentication/login_with_xbox") {
      return repond(200, { access_token: "minecraft-neuf", expires_in: 86400 });
    }

    if (chemin === "/minecraft/profile") {
      return repond(200, {
        id: "uuid-joueur",
        name: "Joueur",
        skins: [{ url: "https://exemple/skin.png" }],
      });
    }

    return repond(404, { erreur: "chemin inconnu" });
  });

  return new Promise((resoudre) => {
    serveur.listen(0, "127.0.0.1", () => {
      const adresse = serveur.address();
      const port = typeof adresse === "object" && adresse ? adresse.port : 0;
      resoudre({
        base: `http://127.0.0.1:${port}`,
        appels,
        ferme: () => serveur.close(),
      });
    });
  });
}

let compteur = 0;

/**
 * Charge les modules a neuf, avec leur environnement.
 *
 * <p>Les URL des services sont lues au chargement du module, et le dossier de
 * donnees a chaque appel: il faut donc un module neuf par scenario, et la
 * chaine de requete suffit a l'ESM pour en fabriquer un.
 */
async function charge(base: string, donnees: string) {
  process.env.MICROSOFT_LOGIN_BASE_URL = base;
  process.env.XBOX_LIVE_BASE_URL = base;
  process.env.XBOX_XSTS_BASE_URL = base;
  process.env.MINECRAFT_SERVICES_BASE_URL = base;
  process.env.XDG_DATA_HOME = donnees;

  compteur++;
  const magasin = await import(
    `../src/modules/auth/accounts.store.js?essai=${compteur}`
  );
  const session = await import(
    `../src/modules/auth/auth.session.js?essai=${compteur}`
  );
  return { magasin, session };
}

function dossierJetable(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "auth-"));
}

/** Un compte enregistre, dont la session expire quand on le demande. */
function enregistre(magasin: any, expiree: boolean) {
  return magasin.saveAccount({
    minecraftUuid: "uuid-joueur",
    minecraftUsername: "Joueur",
    skinUrl: "",
    minecraftAccessToken: expiree ? "minecraft-perime" : "minecraft-valide",
    microsoftRefreshToken: "refresh-dorigine",
    expiresAt: new Date(
      Date.now() + (expiree ? -60_000 : 24 * 3600_000),
    ).toISOString(),
  });
}

/** Un compte nomme, pour les scenarios a plusieurs joueurs. */
function enregistreNomme(magasin: any, uuid: string, pseudonyme: string) {
  return magasin.saveAccount({
    minecraftUuid: uuid,
    minecraftUsername: pseudonyme,
    skinUrl: "",
    minecraftAccessToken: `minecraft-${pseudonyme.toLowerCase()}`,
    microsoftRefreshToken: `refresh-${pseudonyme.toLowerCase()}`,
    expiresAt: new Date(Date.now() + 24 * 3600_000).toISOString(),
  });
}

async function principal() {
  console.log("\n--- session encore valable: aucun appel reseau");
  {
    const faux = await sers({});
    const { magasin, session } = await charge(faux.base, dossierJetable());
    const compte = enregistre(magasin, false);

    const rendu = await session.sessionUtilisable(compte.id);
    verifie(rendu?.accessToken === "minecraft-valide", "le jeton en place est rendu tel quel");
    verifie(faux.appels.length === 0, `aucun appel a Microsoft (${faux.appels.length})`);
    faux.ferme();
  }

  console.log("\n--- session expiree: renouvellement complet");
  {
    const faux = await sers({});
    const donnees = dossierJetable();
    const { magasin, session } = await charge(faux.base, donnees);
    const compte = enregistre(magasin, true);

    const rendu = await session.sessionUtilisable(compte.id);
    verifie(rendu?.accessToken === "minecraft-neuf", "un jeton Minecraft neuf est rendu");
    verifie(
      magasin.getAccount(compte.id)?.refreshToken === "refresh-tourne",
      "le nouveau jeton de renouvellement est enregistre, et non l'ancien",
    );
    verifie(
      magasin.listAccounts().length === 1,
      "le compte n'a pas ete duplique",
    );
    verifie(
      faux.appels.join(",") ===
        "/oauth20_token.srf,/user/authenticate,/xsts/authorize,/authentication/login_with_xbox,/minecraft/profile",
      "les cinq etapes sont parcourues dans l'ordre",
    );
    faux.ferme();
  }

  console.log("\n--- Microsoft refuse le jeton (invalid_grant)");
  {
    const faux = await sers({
      jeton: [{ status: 400, corps: JSON.stringify({ error: "invalid_grant" }) }],
    });
    const { magasin, session } = await charge(faux.base, dossierJetable());
    const compte = enregistre(magasin, true);

    let definitif: boolean | null = null;
    try {
      await session.sessionUtilisable(compte.id);
    } catch (err: any) {
      definitif = err?.definitif ?? null;
    }

    verifie(definitif === true, "l'echec est annonce comme definitif");
    verifie(
      magasin.getAccount(compte.id) === null,
      "le compte est oublie: il faut vraiment se reconnecter",
    );
    verifie(
      faux.appels.filter((a) => a === "/oauth20_token.srf").length === 1,
      "un seul essai: insister sur un refus explicite n'apporte rien",
    );
    faux.ferme();
  }

  console.log("\n--- Xbox Live en panne: le compte doit survivre");
  {
    const faux = await sers({ xbl: 503 });
    const { magasin, session } = await charge(faux.base, dossierJetable());
    const compte = enregistre(magasin, true);

    let definitif: boolean | null = null;
    try {
      await session.sessionUtilisable(compte.id);
    } catch (err: any) {
      definitif = err?.definitif ?? null;
    }

    verifie(definitif === false, "l'echec n'est pas definitif");
    verifie(
      magasin.getAccount(compte.id) !== null,
      "LE COMPTE EST CONSERVE -- c'est tout l'objet de ce banc",
    );
    verifie(
      magasin.getAccount(compte.id)?.refreshToken === "refresh-dorigine",
      "son jeton de renouvellement est intact",
    );
    verifie(
      faux.appels.filter((a) => a === "/user/authenticate").length === 3,
      "trois essais ont ete faits avant d'abandonner",
    );
    faux.ferme();
  }

  console.log("\n--- Microsoft tousse une fois, puis repond");
  {
    const faux = await sers({
      jeton: [{ status: 500, corps: "bad gateway" }],
    });
    const { magasin, session } = await charge(faux.base, dossierJetable());
    const compte = enregistre(magasin, true);

    const rendu = await session.sessionUtilisable(compte.id);
    verifie(
      rendu?.accessToken === "minecraft-neuf",
      "le deuxieme essai rattrape la panne, sans rien demander au joueur",
    );
    verifie(
      magasin.getAccount(compte.id) !== null,
      "le compte est toujours la",
    );
    faux.ferme();
  }

  console.log("\n--- au lancement: le jeton envoye par l'interface est perime");
  {
    const faux = await sers({});
    const { magasin, session } = await charge(faux.base, dossierJetable());
    const compte = enregistre(magasin, true);

    const pour = await session.sessionDeLancement({
      id: compte.id,
      minecraftUuid: compte.minecraftUuid,
      minecraftUsername: compte.minecraftUsername,
      // Ce que l'interface a en memoire depuis le demarrage du launcher.
      accessToken: "minecraft-perime",
    });

    verifie(
      pour.accessToken === "minecraft-neuf",
      "le jeu recoit un jeton renouvele, et non celui que l'interface tenait",
    );
    faux.ferme();
  }

  console.log("\n--- au lancement: compte inconnu du magasin (mode developpement)");
  {
    const faux = await sers({});
    const { session } = await charge(faux.base, dossierJetable());

    const pour = await session.sessionDeLancement({
      id: "local-dev",
      minecraftUuid: "0".repeat(32),
      minecraftUsername: "DEV",
      accessToken: "local-dev-token",
    });

    verifie(pour.accessToken === "local-dev-token", "ce qui a ete envoye est garde tel quel");
    verifie(faux.appels.length === 0, "et rien n'est demande a Microsoft");
    faux.ferme();
  }

  console.log("\n--- au lancement sans identifiant: retrouve par pseudonyme");
  {
    const faux = await sers({});
    const { magasin, session } = await charge(faux.base, dossierJetable());
    enregistre(magasin, true);

    const pour = await session.sessionDeLancement({
      minecraftUuid: "uuid-joueur",
      minecraftUsername: "joueur",
      accessToken: "minecraft-perime",
    });

    verifie(
      pour.accessToken === "minecraft-neuf",
      "un launcher anterieur a la 0.7.31 profite quand meme du renouvellement",
    );
    faux.ferme();
  }

  console.log("\n--- plusieurs comptes: le magasin les garde tous");
  {
    const faux = await sers({});
    const donnees = dossierJetable();
    const { magasin } = await charge(faux.base, donnees);

    const premier = enregistreNomme(magasin, "uuid-un", "Joueur");
    const second = enregistreNomme(magasin, "uuid-deux", "Amie");

    verifie(magasin.listAccounts().length === 2, "les deux comptes sont rendus");
    verifie(
      magasin.getAccount(premier.id)?.minecraftUsername === "Joueur" &&
        magasin.getAccount(second.id)?.minecraftUsername === "Amie",
      "chacun est retrouvable par son identifiant",
    );
    verifie(premier.id !== second.id, "ils ont deux identifiants distincts");

    // Le cas qui comptait: le joueur se reconnecte avec le premier compte
    // alors que le second est enregistre. Le magasin remplace le premier, et
    // le second ne doit pas partir avec.
    const premierANeuf = enregistreNomme(magasin, "uuid-un", "Joueur");
    verifie(
      premierANeuf.id === premier.id,
      "se reconnecter garde le meme identifiant de compte",
    );
    verifie(
      magasin.listAccounts().length === 2,
      "LE SECOND COMPTE SURVIT a la reconnexion du premier",
    );

    // Et au redemarrage du launcher: le magasin est relu depuis le disque, et
    // sa deduplication passe sur chaque lecture.
    compteur++;
    const relu = await import(
      `../src/modules/auth/accounts.store.js?essai=${compteur}`
    );
    process.env.XDG_DATA_HOME = donnees;
    verifie(
      relu.listAccounts().length === 2,
      "les deux comptes sont encore la apres un redemarrage",
    );
    verifie(
      relu
        .listAccounts()
        .map((c: any) => c.minecraftUsername)
        .sort()
        .join(",") === "Amie,Joueur",
      "et ce sont bien les deux memes",
    );
    faux.ferme();
  }

  console.log("\n--- le meme compte deux fois: une seule entree");
  {
    const faux = await sers({});
    const { magasin } = await charge(faux.base, dossierJetable());

    enregistreNomme(magasin, "uuid-un", "Joueur");
    // Microsoft renvoie l'UUID sans tirets ici, avec ailleurs, et le
    // pseudonyme peut changer de casse: aucune des trois formes ne doit
    // produire un doublon.
    enregistreNomme(magasin, "UUID-UN", "joueur");

    verifie(
      magasin.listAccounts().length === 1,
      "un compte deja connu n'est pas duplique",
    );
    faux.ferme();
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

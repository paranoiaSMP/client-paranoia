// Eprouve la restauration de session au demarrage du launcher.
//
// Ce que ce banc protege: ne pas revoir l'ecran de connexion a chaque
// lancement.
//
// Le backend est un processus voisin, demarre par Tauri en meme temps que la
// fenetre, et il met environ une seconde a ecouter. L'interface, elle,
// demandait la liste des comptes des son premier rendu -- donc avant. L'appel
// partait en erreur reseau a chaque demarrage, l'erreur etait avalee en
// silence, et le launcher en concluait qu'aucun compte n'etait enregistre: le
// joueur deja connecte retrouvait l'ecran de connexion, et sur Windows la
// fenetre Microsoft s'ouvrait d'elle-meme par-dessus. Ses comptes etaient
// pourtant tous dans `accounts.json`, intacts.
//
// La regle est donc: on attend le service local, et un echec de lecture ne se
// confond jamais avec « le joueur n'a aucun compte ».
//
// Le module eprouve est celui du launcher (`shared/api/authClient`), servi par
// un faux backend local qui demarre en retard, comme le vrai.
//
// Usage: pnpm exec tsx scripts/test-auth-restore.ts

import http from "node:http";

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
 * Le port que le launcher interroge par defaut.
 *
 * <p>Il n'est pas surchargeable: `http.ts` lit `import.meta.env`, qui n'existe
 * pas hors de Vite. C'est donc le vrai port qui est servi ici -- ce qui a
 * l'avantage de verifier au passage que les deux cotes sont d'accord dessus.
 */
const PORT = 47820;

interface Reglage {
  /** Millisecondes avant que le service se mette a ecouter. */
  demarreApres: number;
  /** Codes HTTP a rendre sur /v1/auth/accounts, un par appel. 200 ensuite. */
  comptes?: number[];
}

interface Faux {
  appels: string[];
  ferme: () => Promise<void>;
}

const DEUX_COMPTES = [
  {
    id: "id-un",
    minecraftUuid: "uuid-un",
    minecraftUsername: "Joueur",
    skinUrl: "",
    accessToken: "jeton-un",
    refreshToken: "refresh-un",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  },
  {
    id: "id-deux",
    minecraftUuid: "uuid-deux",
    minecraftUsername: "Amie",
    skinUrl: "",
    accessToken: "jeton-deux",
    refreshToken: "refresh-deux",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  },
];

function sers(reglage: Reglage): Faux {
  const appels: string[] = [];
  let listesServies = 0;

  const serveur = http.createServer((req, res) => {
    const chemin = (req.url ?? "").split("?")[0] ?? "";
    appels.push(chemin);
    req.resume();

    if (chemin === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ status: "ok" }));
    }

    if (chemin === "/v1/auth/accounts") {
      const prevu = reglage.comptes?.[listesServies++];
      if (prevu && prevu !== 200) {
        res.writeHead(prevu, { "content-type": "application/json" });
        return res.end(JSON.stringify({ message: "pas maintenant" }));
      }
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify(DEUX_COMPTES));
    }

    res.writeHead(404, { "content-type": "application/json" });
    res.end(JSON.stringify({ message: "chemin inconnu" }));
  });

  // Le retard est tout l'objet du banc: le launcher demande ses comptes avant
  // que le service ecoute, exactement comme au demarrage.
  const minuteur = setTimeout(() => {
    serveur.listen(PORT, "127.0.0.1");
  }, reglage.demarreApres);

  return {
    appels,
    ferme: () =>
      new Promise((resoudre) => {
        clearTimeout(minuteur);
        if (!serveur.listening) {
          return resoudre();
        }
        serveur.close(() => resoudre());
      }),
  };
}

let compteur = 0;

/**
 * Charge le client d'authentification du launcher a neuf.
 *
 * <p>Un module neuf par scenario: la chaine de requete suffit a l'ESM pour en
 * fabriquer un, et chaque scenario repart ainsi d'un etat vierge.
 */
async function charge() {
  compteur++;
  return import(
    `../../launcher/src/shared/api/authClient.ts?essai=${compteur}`
  );
}

async function principal() {
  console.log("\n--- le service demarre en retard: on l'attend");
  {
    const faux = sers({ demarreApres: 1200 });
    const client = await charge();

    const debut = Date.now();
    const comptes = await client.comptesEnregistres(10_000);
    const duree = Date.now() - debut;

    verifie(
      comptes.length === 2,
      `les deux comptes enregistres sont rendus (${comptes.length})`,
    );
    verifie(
      duree >= 1000,
      `l'appel a bien attendu le service (${duree} ms)`,
    );
    verifie(
      faux.appels.filter((a) => a === "/health").length >= 1,
      "la sante a ete interrogee avant la liste",
    );
    verifie(
      faux.appels[faux.appels.length - 1] === "/v1/auth/accounts",
      "la liste n'est demandee qu'ensuite",
    );
    await faux.ferme();
  }

  console.log("\n--- le service est deja la: aucune attente");
  {
    const faux = sers({ demarreApres: 0 });
    // Le temps que le serveur prenne le port.
    await new Promise((resoudre) => setTimeout(resoudre, 200));
    const client = await charge();

    const debut = Date.now();
    const comptes = await client.comptesEnregistres(10_000);
    const duree = Date.now() - debut;

    verifie(comptes.length === 2, "les comptes arrivent");
    verifie(duree < 500, `et sans attente inutile (${duree} ms)`);
    await faux.ferme();
  }

  console.log("\n--- la liste echoue une fois, puis repond");
  {
    const faux = sers({ demarreApres: 0, comptes: [503] });
    await new Promise((resoudre) => setTimeout(resoudre, 200));
    const client = await charge();

    const comptes = await client.comptesEnregistres(10_000);
    verifie(
      comptes.length === 2,
      "le second essai rattrape l'echec, sans rien demander au joueur",
    );
    verifie(
      faux.appels.filter((a) => a === "/v1/auth/accounts").length === 2,
      "deux essais, pas plus",
    );
    await faux.ferme();
  }

  console.log("\n--- le service ne demarre pas: l'echec doit se voir");
  {
    const faux = sers({ demarreApres: 60_000 });
    const client = await charge();

    let leve = false;
    try {
      await client.comptesEnregistres(1_500);
    } catch {
      leve = true;
    }

    // Le point le plus important du banc. Rendre une liste vide ici ferait
    // dire au launcher « tu n'as aucun compte » alors que la bonne reponse est
    // « je n'ai pas pu savoir »: la premiere ouvre la fenetre Microsoft d'elle
    // -meme, la seconde attend.
    verifie(
      leve,
      "UNE ERREUR EST LEVEE, et non une liste vide -- c'est tout l'objet de ce banc",
    );
    await faux.ferme();
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

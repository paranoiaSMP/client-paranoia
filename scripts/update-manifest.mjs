#!/usr/bin/env node
// Compose et publie le latest.json d'une release, une plateforme a la fois.
//
// Pourquoi ce script existe: deux workflows publient la meme release --
// build-windows.yml et build-macos.yml -- et chacun ecrivait un latest.json qui
// ne contenait que sa propre plateforme, tous deux televerses sous le meme nom
// par action-gh-release. Le dernier a finir effacait donc l'autre. En 0.7.18
// macOS a publie a 15:01:55 et Windows a 15:03:48: l'entree darwin-aarch64 a
// disparu du manifeste, et les deux jobs sont restes verts. Un client deja
// installe sur la plateforme perdante ne voit plus aucune mise a jour, et rien
// ne le signale: le launcher affiche simplement « a jour ».
//
// Le manifeste n'est donc plus televerse par action-gh-release, qui ecrase sans
// rien lire. Il appartient a ce script, seul, et le script fait une lecture
// avant chaque ecriture: il ajoute son entree et conserve celles des autres.
//
// Il n'y a pas de verrou a prendre sur une release GitHub, donc la lecture et
// l'ecriture ne sont pas atomiques: deux jobs peuvent lire le meme etat et
// s'ecraser l'un l'autre. Plutot que de faire semblant que cela n'arrive pas, le
// script relit ce qu'il vient de publier et recommence tout le cycle si son
// entree -- ou celle d'un autre qu'il avait conservee -- n'y est plus. Cela
// converge: le perdant d'une course la refait, et sa seconde lecture voit le
// gagnant.
//
// Usage:
//   node scripts/update-manifest.mjs --tag v0.7.19 \
//     --platform windows-x86_64 --signature <fichier .sig> \
//     --url <url de telechargement>
//
// A lancer apres la creation de la release, le manifeste etant le dernier actif
// ecrit.
//
// Environnement: GITHUB_TOKEN, GITHUB_REPOSITORY.

import { readFileSync } from 'node:fs';

const NOTES = 'Voir les notes de version sur GitHub.';
const ACTIF = 'latest.json';
const ESSAIS = 5;

function args() {
  const out = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const nom = argv[i];
    if (!nom.startsWith('--')) {
      throw new Error(`argument inattendu: ${nom}`);
    }
    const valeur = argv[++i];
    if (valeur === undefined) {
      throw new Error(`${nom} attend une valeur`);
    }
    out[nom.slice(2)] = valeur;
  }
  for (const nom of ['tag', 'platform', 'signature', 'url']) {
    if (!out[nom]) {
      throw new Error(`--${nom} est obligatoire`);
    }
  }
  return out;
}

function environnement(nom) {
  const valeur = process.env[nom];
  if (!valeur) {
    throw new Error(`${nom} absent de l environnement`);
  }
  return valeur;
}

const JETON = environnement('GITHUB_TOKEN');

// Actions fournit GITHUB_API_URL, et la release porte elle-meme son upload_url:
// aucun des deux hotes n'a besoin d'etre ecrit ici. C'est aussi ce qui rend le
// script executable contre un serveur local, ce que fait scripts/test-update-manifest.mjs.
const API = process.env.GITHUB_API_URL ?? 'https://api.github.com';

/**
 * Un appel a l'API GitHub, avec quelques essais.
 *
 * Une coupure reseau au moment de publier une version couterait une release
 * entiere a refaire: mieux vaut reessayer qu'echouer sur un paquet perdu. Un 404
 * n'est pas une erreur reseau: il rend null, et c'est a l'appelant de dire si
 * l'absence est normale.
 */
async function api(url, options = {}) {
  let derniere;
  for (let essai = 1; essai <= 3; essai++) {
    try {
      const reponse = await fetch(url, {
        ...options,
        headers: {
          accept: 'application/vnd.github+json',
          authorization: `Bearer ${JETON}`,
          'x-github-api-version': '2022-11-28',
          'user-agent': 'paranoia-client-release',
          ...(options.headers ?? {}),
        },
      });
      if (reponse.status === 404) {
        return null;
      }
      if (!reponse.ok) {
        const corps = await reponse.text().catch(() => '');
        const erreur = new Error(
          `${reponse.status} ${reponse.statusText} sur ${url}${corps ? ` -- ${corps.slice(0, 200)}` : ''}`,
        );
        erreur.status = reponse.status;
        throw erreur;
      }
      return reponse.status === 204 ? '' : await reponse.text();
    } catch (erreur) {
      derniere = erreur;
      // Un conflit vient d'un autre job, pas du reseau: le cycle complet le
      // rattrapera, inutile de s'acharner ici.
      if (erreur.status === 422) {
        throw erreur;
      }
      if (essai < ESSAIS && essai < 3) {
        await new Promise((resoudre) => setTimeout(resoudre, essai * 2000));
      }
    }
  }
  throw derniere;
}

async function release(depot, tag) {
  const brut = await api(`${API}/repos/${depot}/releases/tags/${tag}`);
  if (brut === null) {
    throw new Error(
      `aucune release ${tag}: ce script doit tourner apres l etape de publication`,
    );
  }
  return JSON.parse(brut);
}

/**
 * Le latest.json deja attache a la release, ou null.
 *
 * Par l'API et non par l'URL publique de telechargement: celle-ci passe par un
 * cache, et publier puis relire immediatement y rend une version perimee --
 * c'est-a-dire exactement le cas qui nous interesse ici.
 */
async function manifeste(actifs) {
  const actif = actifs.find((a) => a.name === ACTIF);
  if (!actif) {
    return null;
  }
  const contenu = await api(actif.url, { headers: { accept: 'application/octet-stream' } });
  if (contenu === null) {
    return null;
  }
  try {
    return JSON.parse(contenu);
  } catch {
    // Un manifeste illisible ne doit pas bloquer la publication: on le remplace.
    console.log(`${ACTIF} present mais illisible: remplace`);
    return null;
  }
}

function plateformesConservees(existant, version) {
  if (existant === null) {
    console.log(`aucun ${ACTIF} sur la release: premier job a publier`);
    return {};
  }
  if (existant.version !== version) {
    // Chaque release a son propre actif, donc cela ne devrait pas arriver. Mais
    // un manifeste d'une autre version ne porterait que des URL mortes et des
    // signatures que le client refuserait: on repart de zero.
    console.log(
      `${ACTIF} present mais en version ${existant.version}, attendu ${version}: ignore`,
    );
    return {};
  }
  const gardees = { ...(existant.platforms ?? {}) };
  const noms = Object.keys(gardees);
  console.log(
    `${ACTIF} present, plateformes conservees: ${noms.length ? noms.sort().join(', ') : 'aucune'}`,
  );
  return gardees;
}

async function televerse(depot, rel, corps) {
  const ancien = rel.assets.find((a) => a.name === ACTIF);
  if (ancien) {
    await api(`${API}/repos/${depot}/releases/assets/${ancien.id}`, {
      method: 'DELETE',
    });
  }

  // upload_url est un gabarit RFC 6570: « .../assets{?name,label} ».
  const url = `${rel.upload_url.replace(/\{.*\}$/, '')}?name=${encodeURIComponent(ACTIF)}`;
  await api(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(corps)),
    },
    body: corps,
  });
}

/** L'entree du job, et toutes celles qu'il avait conservees, sont-elles la ? */
function complet(publie, version, attendues) {
  if (publie === null || publie.version !== version) {
    return false;
  }
  const presentes = Object.keys(publie.platforms ?? {});
  return attendues.every((nom) => presentes.includes(nom));
}

async function principal() {
  const options = args();
  const depot = environnement('GITHUB_REPOSITORY');
  const version = options.tag.replace(/^v/, '');

  const signature = readFileSync(options.signature, 'utf8').trim();
  if (!signature) {
    throw new Error(`signature vide: ${options.signature}`);
  }

  for (let essai = 1; essai <= ESSAIS; essai++) {
    const rel = await release(depot, options.tag);
    const plateformes = plateformesConservees(await manifeste(rel.assets), version);
    plateformes[options.platform] = { signature, url: options.url };

    const attendues = Object.keys(plateformes);
    const corps = `${JSON.stringify(
      {
        version,
        notes: NOTES,
        pub_date: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
        platforms: plateformes,
      },
      null,
      2,
    )}\n`;

    try {
      await televerse(depot, rel, corps);
    } catch (erreur) {
      if (erreur.status !== 422 || essai === ESSAIS) {
        throw erreur;
      }
      // 422 = l'actif existe deja: un autre job l'a televerse entre notre
      // suppression et notre envoi. On recommence sur son etat.
      console.log(`${ACTIF} pris par un autre job, nouvelle tentative`);
      await new Promise((resoudre) => setTimeout(resoudre, essai * 3000));
      continue;
    }

    // Relire n'est pas une precaution de principe: c'est la seule chose qui
    // distingue « publie » de « publie et toujours la ».
    const relu = await release(depot, options.tag);
    if (complet(await manifeste(relu.assets), version, attendues)) {
      console.log(
        `${ACTIF} publie pour ${version}, plateformes: ${attendues.sort().join(', ')}`,
      );
      return;
    }

    if (essai === ESSAIS) {
      throw new Error(
        `${ACTIF} publie ${ESSAIS} fois sans que ${attendues.sort().join(', ')} y survive`,
      );
    }
    console.log(`${ACTIF} ecrase par un autre job, nouvelle tentative`);
    await new Promise((resoudre) => setTimeout(resoudre, essai * 3000));
  }
}

try {
  await principal();
} catch (erreur) {
  console.error(`::error::${erreur.message}`);
  process.exit(1);
}

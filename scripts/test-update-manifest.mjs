#!/usr/bin/env node
// Eprouve scripts/update-manifest.mjs contre une fausse API de release.
//
// Pourquoi un test et pas une relecture attentive: ce script ne s'execute que
// pendant une publication, et son echec ne se voit pas la ou on regarde. S'il se
// trompe, la release part quand meme, les jobs restent verts, et le defaut
// n'apparait que chez un joueur qui ne recoit plus de mise a jour -- c'est
// exactement ce qui est arrive en 0.7.18. Un banc d'essai local est la seule
// facon de savoir avant de publier.
//
// Le serveur imite ce que le script utilise de l'API GitHub, et rien de plus:
// lire une release par son tag, lire un actif, en supprimer un, en televerser un.
// Il sait aussi tricher -- refuser un envoi, effacer une entree juste apres
// qu'elle a ete ecrite -- pour rejouer les courses entre les deux workflows.
//
// Usage: node scripts/test-update-manifest.mjs

import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = fileURLToPath(new URL('./update-manifest.mjs', import.meta.url));
const DEPOT = 'paranoiaSMP/client-paranoia';
const TAG = 'v9.9.9';

const dossier = mkdtempSync(join(tmpdir(), 'manifeste-'));
const SIG_WINDOWS = join(dossier, 'windows.sig');
const SIG_DARWIN = join(dossier, 'darwin.sig');
writeFileSync(SIG_WINDOWS, 'SIGNATURE-WINDOWS\n');
writeFileSync(SIG_DARWIN, 'SIGNATURE-DARWIN\n');

/** L'etat que le serveur expose, remis a neuf avant chaque scenario. */
function etatNeuf(options = {}) {
  return {
    // null = la release n'existe pas encore.
    release: options.release === undefined ? { id: 42 } : options.release,
    actifs: new Map(options.actifs ?? []),
    prochainId: 100,
    // Triches: nombre d'envois a refuser par un 422, et nombre de fois ou le
    // serveur doit retirer l'entree qui vient d'etre ecrite.
    refus: options.refus ?? 0,
    sabotages: options.sabotages ?? 0,
    // Ce que le saboteur remet a la place, pour imiter l'autre workflow.
    aLaPlace: options.aLaPlace ?? null,
    envois: 0,
  };
}

let etat = etatNeuf();
let base = '';

function corpsDeRelease() {
  return JSON.stringify({
    id: etat.release.id,
    tag_name: TAG,
    upload_url: `${base}/repos/${DEPOT}/releases/${etat.release.id}/assets{?name,label}`,
    assets: [...etat.actifs.entries()].map(([nom, actif]) => ({
      id: actif.id,
      name: nom,
      url: `${base}/repos/${DEPOT}/releases/assets/${actif.id}`,
    })),
  });
}

function actifParId(id) {
  for (const [nom, actif] of etat.actifs) {
    if (actif.id === id) {
      return { nom, actif };
    }
  }
  return null;
}

async function litCorps(requete) {
  const morceaux = [];
  for await (const morceau of requete) {
    morceaux.push(morceau);
  }
  return Buffer.concat(morceaux).toString('utf8');
}

const serveur = createServer(async (requete, reponse) => {
  const url = new URL(requete.url, base);
  const chemin = url.pathname;

  if (!requete.headers.authorization?.startsWith('Bearer ')) {
    reponse.writeHead(401).end('jeton absent');
    return;
  }

  if (requete.method === 'GET' && chemin === `/repos/${DEPOT}/releases/tags/${TAG}`) {
    if (etat.release === null) {
      reponse.writeHead(404).end('{}');
      return;
    }
    reponse.writeHead(200, { 'content-type': 'application/json' }).end(corpsDeRelease());
    return;
  }

  const lecture = chemin.match(new RegExp(`^/repos/${DEPOT}/releases/assets/(\\d+)$`));
  if (lecture) {
    const trouve = actifParId(Number(lecture[1]));
    if (requete.method === 'DELETE') {
      if (trouve) {
        etat.actifs.delete(trouve.nom);
      }
      reponse.writeHead(204).end();
      return;
    }
    if (requete.method === 'GET') {
      if (!trouve) {
        reponse.writeHead(404).end('{}');
        return;
      }
      reponse.writeHead(200, { 'content-type': 'application/octet-stream' })
        .end(trouve.actif.contenu);
      return;
    }
  }

  const envoi = chemin.match(new RegExp(`^/repos/${DEPOT}/releases/(\\d+)/assets$`));
  if (envoi && requete.method === 'POST') {
    const contenu = await litCorps(requete);
    const nom = url.searchParams.get('name');

    if (etat.refus > 0) {
      etat.refus--;
      reponse.writeHead(422).end('{"message":"already_exists"}');
      return;
    }

    etat.envois++;
    etat.actifs.set(nom, { id: etat.prochainId++, contenu });

    // Le saboteur imite l'autre workflow: il ecrase le manifeste juste apres.
    if (etat.sabotages > 0) {
      etat.sabotages--;
      etat.actifs.set(nom, {
        id: etat.prochainId++,
        contenu: etat.aLaPlace ?? JSON.stringify({ version: '9.9.9', platforms: {} }),
      });
    }

    reponse.writeHead(201, { 'content-type': 'application/json' }).end('{}');
    return;
  }

  reponse.writeHead(404).end(`chemin inconnu: ${requete.method} ${chemin}`);
});

function lance(plateforme, signature) {
  return new Promise((resoudre) => {
    const enfant = spawn(process.execPath, [
      SCRIPT,
      '--tag', TAG,
      '--platform', plateforme,
      '--signature', signature,
      '--url', `https://exemple/${plateforme}`,
    ], {
      env: {
        ...process.env,
        GITHUB_TOKEN: 'jeton-de-test',
        GITHUB_REPOSITORY: DEPOT,
        GITHUB_API_URL: base,
      },
    });

    let sortie = '';
    enfant.stdout.on('data', (d) => { sortie += d; });
    enfant.stderr.on('data', (d) => { sortie += d; });
    enfant.on('close', (code) => resoudre({ code, sortie }));
  });
}

function manifestePublie() {
  const actif = etat.actifs.get('latest.json');
  return actif ? JSON.parse(actif.contenu) : null;
}

function actifDe(version, plateformes) {
  return ['latest.json', {
    id: 7,
    contenu: JSON.stringify({ version, notes: '', pub_date: '', platforms: plateformes }),
  }];
}

let echecs = 0;
const cas = [];

function scenario(nom, prepare, verifie) {
  cas.push({ nom, prepare, verifie });
}

function affirme(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// --- Le cas ordinaire: rien sur la release, un job publie. -------------------
scenario('premier job: une seule plateforme', () => etatNeuf(), async () => {
  const { code } = await lance('windows-x86_64', SIG_WINDOWS);
  affirme(code === 0, `sortie ${code}`);
  const m = manifestePublie();
  affirme(m.version === '9.9.9', `version ${m.version}`);
  affirme(Object.keys(m.platforms).join() === 'windows-x86_64', Object.keys(m.platforms).join());
  affirme(m.platforms['windows-x86_64'].signature === 'SIGNATURE-WINDOWS', 'signature');
  affirme(m.platforms['windows-x86_64'].url === 'https://exemple/windows-x86_64', 'url');
});

// --- Le defaut de 0.7.18: le second job ne doit plus effacer le premier. -----
scenario(
  'second job: conserve la plateforme de l autre',
  () => etatNeuf({ actifs: [actifDe('9.9.9', { 'darwin-aarch64': { signature: 'S', url: 'U' } })] }),
  async () => {
    const { code } = await lance('windows-x86_64', SIG_WINDOWS);
    affirme(code === 0, `sortie ${code}`);
    const noms = Object.keys(manifestePublie().platforms).sort();
    affirme(noms.join() === 'darwin-aarch64,windows-x86_64', noms.join());
    affirme(manifestePublie().platforms['darwin-aarch64'].url === 'U', 'url darwin perdue');
  },
);

// --- Relancer un job: il remplace sa propre entree, pas celle des autres. ----
scenario(
  'job relance: remplace son entree, garde l autre',
  () => etatNeuf({
    actifs: [actifDe('9.9.9', {
      'darwin-aarch64': { signature: 'S', url: 'U' },
      'windows-x86_64': { signature: 'PERIMEE', url: 'PERIMEE' },
    })],
  }),
  async () => {
    const { code } = await lance('windows-x86_64', SIG_WINDOWS);
    affirme(code === 0, `sortie ${code}`);
    const m = manifestePublie();
    affirme(m.platforms['windows-x86_64'].signature === 'SIGNATURE-WINDOWS', 'pas remplacee');
    affirme(m.platforms['darwin-aarch64'].url === 'U', 'url darwin perdue');
  },
);

// --- Un manifeste d'une autre version ne porte que des URL mortes. ----------
scenario(
  'version differente: reparti de zero',
  () => etatNeuf({ actifs: [actifDe('1.0.0', { 'darwin-aarch64': { signature: 'S', url: 'U' } })] }),
  async () => {
    const { code, sortie } = await lance('windows-x86_64', SIG_WINDOWS);
    affirme(code === 0, `sortie ${code}`);
    affirme(sortie.includes('ignore'), 'le motif du rejet n est pas dit');
    const noms = Object.keys(manifestePublie().platforms);
    affirme(noms.join() === 'windows-x86_64', noms.join());
  },
);

// --- La course: l'autre job ecrase juste apres notre envoi. ------------------
scenario(
  'course perdue une fois: le cycle est refait',
  () => etatNeuf({
    sabotages: 1,
    aLaPlace: JSON.stringify({
      version: '9.9.9',
      platforms: { 'darwin-aarch64': { signature: 'S', url: 'U' } },
    }),
  }),
  async () => {
    const { code, sortie } = await lance('windows-x86_64', SIG_WINDOWS);
    affirme(code === 0, `sortie ${code}`);
    affirme(sortie.includes('ecrase par un autre job'), 'la course n a pas ete vue');
    const noms = Object.keys(manifestePublie().platforms).sort();
    // Le second tour lit l'etat du saboteur: les deux plateformes y sont.
    affirme(noms.join() === 'darwin-aarch64,windows-x86_64', noms.join());
  },
);

// --- Un envoi refuse parce que l'actif vient d'etre recree ailleurs. --------
scenario('envoi refuse une fois: reessaye', () => etatNeuf({ refus: 1 }), async () => {
  const { code, sortie } = await lance('windows-x86_64', SIG_WINDOWS);
  affirme(code === 0, `sortie ${code}`);
  affirme(sortie.includes('pris par un autre job'), 'le refus n a pas ete vu');
  affirme(Object.keys(manifestePublie().platforms).join() === 'windows-x86_64', 'manifeste');
});

// --- Ce qui doit echouer, et echouer en le disant. --------------------------
scenario('aucune release: echoue clairement', () => etatNeuf({ release: null }), async () => {
  const { code, sortie } = await lance('windows-x86_64', SIG_WINDOWS);
  affirme(code === 1, `sortie ${code}`);
  affirme(sortie.includes('apres l etape de publication'), sortie.trim());
});

scenario('signature vide: echoue', () => etatNeuf(), async () => {
  const vide = join(dossier, 'vide.sig');
  writeFileSync(vide, '   \n');
  const { code, sortie } = await lance('windows-x86_64', vide);
  affirme(code === 1, `sortie ${code}`);
  affirme(sortie.includes('signature vide'), sortie.trim());
});

scenario(
  'ecrase sans relache: echoue au lieu de mentir',
  () => etatNeuf({ sabotages: 99 }),
  async () => {
    const { code, sortie } = await lance('windows-x86_64', SIG_WINDOWS);
    affirme(code === 1, `sortie ${code}`);
    affirme(sortie.includes('sans que'), sortie.trim());
    affirme(etat.envois === 5, `${etat.envois} envois, 5 attendus`);
  },
);

serveur.listen(0, '127.0.0.1', async () => {
  base = `http://127.0.0.1:${serveur.address().port}`;

  for (const { nom, prepare, verifie } of cas) {
    etat = prepare();
    try {
      await verifie();
      console.log(`  ok    ${nom}`);
    } catch (erreur) {
      echecs++;
      console.log(`  ECHEC ${nom}: ${erreur.message}`);
    }
  }

  serveur.close();
  if (echecs > 0) {
    console.error(`::error::${echecs} scenario(s) en echec sur ${cas.length}`);
    process.exit(1);
  }
  console.log(`${cas.length} scenarios verts`);
});

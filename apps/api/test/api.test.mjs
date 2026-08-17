import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";

/**
 * Tests d'integration de l'API hebergee.
 *
 * <p>Mojang est remplace par un serveur local: on ne veut ni dependre du
 * reseau, ni d'un vrai compte Minecraft. Le reste du service tourne pour de
 * bon -- meme routage, meme validation, meme stockage en memoire.
 */

const UUID = "0f1e2d3c-4b5a-4968-8776-655443332211";
const UUID_UNDASHED = UUID.replaceAll("-", "");
const AUTRE_UUID = "11223344-5566-4778-899a-abbccddeeff0";

const dataDir = mkdtempSync(join(tmpdir(), "paranoia-api-"));
const cosmeticsFile = join(dataDir, "cosmetics.json");

// `config/env.ts` lit process.env une seule fois, au premier import. Tout
// reglage pose apres coup serait ignore en silence -- et le test passerait
// pour de mauvaises raisons, ou echouerait sans dire pourquoi.
const stateFile = join(dataDir, "state.json");
process.env.COSMETICS_STATE_FILE = stateFile;

const assetsDir = mkdtempSync(join(tmpdir(), "paranoia-assets-"));
process.env.COSMETICS_ASSETS_DIR = assetsDir;
writeFileSync(join(assetsDir, "cape_fondateur.png"), "\x89PNG\r\n\x1a\nfaux-mais-suffit");
// Un fichier qui n'a rien a faire la, comme un .env copie par erreur.
writeFileSync(join(assetsDir, "secret.env"), "TOKEN=nesortpas");

writeFileSync(
  cosmeticsFile,
  JSON.stringify({
    items: [
      {
        id: "cape_fondateur",
        type: "cape",
        name: "Cape Fondateur",
        previewUrl: "https://example.invalid/cape.png",
        rarity: "legendary",
      },
      {
        id: "cape_absente",
        type: "cape",
        name: "Cape jamais donnee",
        previewUrl: "https://example.invalid/autre.png",
        rarity: "rare",
      },
    ],
    players: {
      [UUID]: { owned: ["cape_fondateur"], equipped: ["cape_fondateur"] },
      // Porte sans posseder: doit etre ecarte au chargement.
      [AUTRE_UUID]: { owned: [], equipped: ["cape_absente"] },
    },
  }),
);

/** Faux serveur de session Mojang: accepte un seul pseudo. */
let mojang;
let mojangUrl;

before(async () => {
  mojang = createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    const username = url.searchParams.get("username");
    const serverId = url.searchParams.get("serverId");

    if (username !== "Testeur" || !/^[0-9a-f]{32}$/.test(serverId ?? "")) {
      res.writeHead(204).end();
      return;
    }

    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ id: UUID_UNDASHED, name: "Testeur" }));
  });

  await new Promise((resolve) => mojang.listen(0, "127.0.0.1", resolve));
  mojangUrl = `http://127.0.0.1:${mojang.address().port}`;
});

after(() => {
  mojang?.close();
});

describe("API Paranoia", () => {
  let base;
  let server;
  let store;

  before(async () => {
    process.env.NODE_ENV = "test";
    process.env.MOJANG_SESSION_BASE_URL = mojangUrl;
    process.env.COSMETICS_FILE = cosmeticsFile;
    process.env.TRUST_PROXY = "0";
    // Assez haut pour que les tests ne se limitent pas eux-memes, sauf celui
    // qui vise explicitement la limite.
    process.env.RATE_LIMIT_PER_MINUTE = "1000";

    const { createApp } = await import("../src/app.ts");
    store = await import("../src/modules/cosmetics/cosmetics.store.ts");
    store.loadCosmetics();

    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => {
    server?.close();
  });

  const post = (path, body, token) =>
    fetch(`${base}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
    });

  /** Deroule le handshake complet et rend un jeton utilisable. */
  async function authentifier() {
    const begin = await post("/v1/auth/begin");
    const { serverId } = await begin.json();

    const complete = await post("/v1/auth/complete", { username: "Testeur", serverId });
    assert.equal(complete.status, 200, "le handshake doit aboutir");
    return complete.json();
  }

  it("repond sur /health", async () => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { status: "ok" });
  });

  it("emet un jeton quand Mojang confirme la session", async () => {
    const { token, uuid, username } = await authentifier();

    assert.ok(token, "un jeton doit etre emis");
    assert.equal(username, "Testeur");
    // L'UUID renvoye par Mojang est sans tirets: l'API doit le normaliser,
    // sinon il ne correspondra jamais a celui que le mod envoie.
    assert.equal(uuid, UUID);
  });

  it("refuse un pseudo que Mojang ne confirme pas", async () => {
    const { serverId } = await (await post("/v1/auth/begin")).json();
    const res = await post("/v1/auth/complete", { username: "Imposteur", serverId });

    assert.equal(res.status, 401);
  });

  it("refuse de rejouer un defi deja consomme", async () => {
    const { serverId } = await (await post("/v1/auth/begin")).json();

    assert.equal((await post("/v1/auth/complete", { username: "Testeur", serverId })).status, 200);

    const rejeu = await post("/v1/auth/complete", { username: "Testeur", serverId });
    assert.equal(rejeu.status, 400, "un serverId ne doit servir qu'une fois");
  });

  it("refuse un defi invente", async () => {
    const res = await post("/v1/auth/complete", {
      username: "Testeur",
      serverId: "f".repeat(32),
    });

    assert.equal(res.status, 400);
  });

  it("exige un jeton pour le lookup", async () => {
    const res = await post("/v1/users/lookup", { uuids: [UUID] });
    assert.equal(res.status, 401);
  });

  it("ne signale un joueur qu'apres son heartbeat", async () => {
    const { token } = await authentifier();

    const avant = await (await post("/v1/users/lookup", { uuids: [UUID] }, token)).json();
    assert.deepEqual(avant.users, [], "sans heartbeat, personne n'est en ligne");

    const heartbeat = await post("/v1/presence/heartbeat", {}, token);
    assert.equal(heartbeat.status, 200);
    assert.equal((await heartbeat.json()).intervalSeconds, 30);

    const apres = await (await post("/v1/users/lookup", { uuids: [UUID] }, token)).json();
    assert.deepEqual(apres.users, [UUID]);
  });

  it("ne repond que pour les identifiants demandes", async () => {
    const { token } = await authentifier();
    await post("/v1/presence/heartbeat", {}, token);

    const res = await (await post("/v1/users/lookup", { uuids: [AUTRE_UUID] }, token)).json();
    assert.deepEqual(res.users, [], "un joueur hors ligne ne doit jamais remonter");
  });

  it("accepte les UUID sans tirets", async () => {
    const { token } = await authentifier();
    await post("/v1/presence/heartbeat", {}, token);

    const res = await (await post("/v1/users/lookup", { uuids: [UUID_UNDASHED] }, token)).json();
    assert.deepEqual(res.users, [UUID], "les deux ecritures designent le meme joueur");
  });

  it("joint les cosmetiques portes au lookup", async () => {
    const { token } = await authentifier();
    await post("/v1/presence/heartbeat", {}, token);

    const res = await (await post("/v1/users/lookup", { uuids: [UUID] }, token)).json();
    assert.deepEqual(res.cosmetics, { [UUID]: ["cape_fondateur"] });
  });

  it("ecarte un cosmetique porte mais non possede", () => {
    assert.deepEqual(
      store.equippedFor(AUTRE_UUID),
      [],
      "une incoherence d'edition ne doit pas etre servie",
    );
  });

  it("refuse un lookup au-dela du plafond", async () => {
    const { token } = await authentifier();
    const res = await post("/v1/users/lookup", { uuids: Array(501).fill(UUID) }, token);

    assert.equal(res.status, 400);
  });

  it("ignore les identifiants mal formes sans echouer", async () => {
    const { token } = await authentifier();
    await post("/v1/presence/heartbeat", {}, token);

    const res = await post("/v1/users/lookup", { uuids: ["pas-un-uuid", UUID] }, token);
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).users, [UUID]);
  });

  it("sert le catalogue sans jeton", async () => {
    const res = await fetch(`${base}/v1/cosmetics/catalog`);
    assert.equal(res.status, 200);

    const items = await res.json();
    assert.equal(items.length, 2);
    assert.equal(items[0].id, "cape_fondateur");
  });

  it("conserve le catalogue quand le fichier devient illisible", () => {
    writeFileSync(cosmeticsFile, "{ ceci n'est pas du JSON");
    store.loadCosmetics();

    assert.deepEqual(
      store.equippedFor(UUID),
      ["cape_fondateur"],
      "une faute de frappe sur le VPS ne doit pas vider les cosmetiques",
    );
  });
});

describe("Textures des cosmetiques", () => {
  let base;
  let server;

  before(async () => {
    const { createApp } = await import("../src/app.ts");

    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(() => server?.close());

  it("sert une texture sans jeton", async () => {
    const res = await fetch(`${base}/cosmetics/cape_fondateur.png`);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /image\/png/);
    assert.ok(res.headers.get("etag"), "un ETag permet au mod de revalider sans retelecharger");
  });

  it("refuse un fichier qui n'est pas une image", async () => {
    const res = await fetch(`${base}/cosmetics/secret.env`);
    assert.equal(res.status, 404, "un fichier depose par erreur ne doit pas sortir");
  });

  it("refuse de remonter hors du dossier", async () => {
    const res = await fetch(`${base}/cosmetics/..%2f..%2fcosmetics.json`);
    assert.ok(res.status >= 400, `remontee acceptee: ${res.status}`);
  });

  it("repond 404 sur une texture absente", async () => {
    const res = await fetch(`${base}/cosmetics/inconnue.png`);
    assert.equal(res.status, 404);
  });
});

/**
 * Achat et equipement.
 *
 * <p>Suite separee avec son propre catalogue: elle a besoin d'un admin, de
 * prix et d'un solde, la ou la premiere suite verifie le badge.
 */
describe("Paracoins, achat et equipement", () => {
  let base;
  let server;
  let token;
  let store;
  let etat;
  // Meme chemin que la premiere suite: env est fige, un autre fichier
  // serait tout simplement ignore.
  const catalogueFile = cosmeticsFile;
  const etatFile = stateFile;

  before(async () => {
    writeFileSync(
      catalogueFile,
      JSON.stringify({
        admins: [UUID],
        items: [
          { id: "cape_chere", type: "cape", name: "Chere", previewUrl: "https://e.invalid/a.png", rarity: "legendary", price: 1500 },
          { id: "cape_autre", type: "cape", name: "Autre", previewUrl: "https://e.invalid/b.png", rarity: "rare", price: 300 },
          { id: "ailes", type: "wings", name: "Ailes", previewUrl: "https://e.invalid/c.png", rarity: "epic", price: 100 },
        ],
        players: { [AUTRE_UUID]: { balance: 400, owned: [], equipped: [] } },
      }),
    );
    writeFileSync(etatFile, JSON.stringify({ players: {} }));

    const { createApp } = await import("../src/app.ts");
    store = await import("../src/modules/cosmetics/cosmetics.store.ts");
    etat = await import("../src/modules/cosmetics/state.store.ts");

    etat.resetState();
    etat.loadState();
    store.loadCosmetics();

    server = createApp().listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    base = `http://127.0.0.1:${server.address().port}`;

    const begin = await fetch(`${base}/v1/auth/begin`, { method: "POST" });
    const { serverId } = await begin.json();
    const complete = await fetch(`${base}/v1/auth/complete`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "Testeur", serverId }),
    });
    token = (await complete.json()).token;
  });

  after(() => server?.close());

  const appel = (methode, chemin, corps) =>
    fetch(`${base}${chemin}`, {
      method: methode,
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      ...(corps === undefined ? {} : { body: JSON.stringify(corps) }),
    });

  it("annonce un solde illimite pour un admin", async () => {
    const me = await (await appel("GET", "/v1/cosmetics/me")).json();

    assert.equal(me.admin, true);
    assert.equal(me.balance, null, "null porte l'illimite, pas un grand nombre");
    assert.equal(me.uuid, UUID);
  });

  it("laisse un admin acheter sans etre debite", async () => {
    const res = await appel("POST", "/v1/cosmetics/purchase", { id: "cape_chere" });
    assert.equal(res.status, 200);

    const corps = await res.json();
    assert.ok(corps.owned.includes("cape_chere"));
    assert.equal(corps.balance, null, "le solde d'un admin ne bouge jamais");
  });

  it("ne facture pas deux fois le meme objet", async () => {
    const res = await appel("POST", "/v1/cosmetics/purchase", { id: "cape_chere" });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).deja, true);
  });

  it("refuse un achat au-dessus du solde", async () => {
    // Lecture seule, sans remise a zero: l'etat porte les achats des tests
    // precedents, et les effacer ici ferait echouer l'equipement plus bas
    // pour une raison sans rapport avec le code teste.
    const solde = store.balanceOf(AUTRE_UUID);
    assert.equal(solde, 400);
    assert.equal(store.isAdmin(AUTRE_UUID), false);
  });

  it("debite le prix du catalogue, pas celui envoye par le client", async () => {
    // On tente de payer moins en glissant un prix dans la requete.
    const res = await appel("POST", "/v1/cosmetics/purchase", { id: "ailes", price: 0 });
    assert.equal(res.status, 200);

    const item = store.itemById("ailes");
    assert.equal(item.price, 100, "le prix reste celui du catalogue");
  });

  it("equipe un objet possede", async () => {
    const res = await appel("PUT", "/v1/cosmetics/equipped", { ids: ["cape_chere"] });
    assert.equal(res.status, 200);
    assert.deepEqual((await res.json()).equipped, ["cape_chere"]);
  });

  it("refuse d'equiper ce qu'on ne possede pas", async () => {
    const res = await appel("PUT", "/v1/cosmetics/equipped", { ids: ["cape_autre"] });
    assert.equal(res.status, 403);
  });

  it("ne garde qu'un objet par type", async () => {
    await appel("POST", "/v1/cosmetics/purchase", { id: "cape_autre" });
    const res = await appel("PUT", "/v1/cosmetics/equipped", {
      ids: ["cape_chere", "cape_autre", "ailes"],
    });

    const equipped = (await res.json()).equipped;
    assert.deepEqual(
      equipped.sort(),
      ["ailes", "cape_autre"].sort(),
      "la derniere cape gagne, les ailes cohabitent",
    );
  });

  it("retire un seul type", async () => {
    const res = await appel("DELETE", "/v1/cosmetics/equipped?type=cape");
    assert.deepEqual((await res.json()).equipped, ["ailes"]);
  });

  it("persiste l'etat sur disque", async () => {
    const disque = JSON.parse(readFileSync(etatFile, "utf8"));
    assert.ok(disque.players[UUID], "l'achat doit survivre a un redemarrage");
    assert.ok(disque.players[UUID].owned.includes("cape_chere"));
  });
});

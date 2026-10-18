// Banc des routes de skin: valide les refus avant tout appel a Mojang.
//
// Hermetique: le dossier de donnees est detourne vers un dossier temporaire,
// avec un faux compte au jeton non expire. Rien n'est lu des vrais comptes de
// la machine, et rien ne part sur le reseau -- chaque cas echoue avant l'envoi.
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const dataHome = mkdtempSync(join(tmpdir(), "paranoia-skins-"));
process.env.XDG_DATA_HOME = dataHome;
process.env.APPDATA = dataHome;

const { default: express } = await import("express");
const { ZodError } = await import("zod");
const { skinsRouter } = await import("../src/modules/skins/skins.routes.js");
const { paranoiaDataDir } = await import("../src/modules/launcher/paths.js");

const app = express();
app.use(express.json());
app.use("/v1/skins", skinsRouter);
// Meme traduction que le serveur: une validation zod devient une 400.
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err instanceof ZodError ? 400 : 500).json({ message: String(err) });
});

const server = app.listen(0);
const port = (server.address() as { port: number }).port;

async function post(body: unknown): Promise<[number, any]> {
  const res = await fetch(`http://127.0.0.1:${port}/v1/skins`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return [res.status, await res.json().catch(() => null)];
}

/** PNG minimal: signature + IHDR avec les dimensions voulues. */
function png(width: number, height: number, padding = 0): string {
  const buf = Buffer.alloc(33 + padding);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf);
  buf.writeUInt32BE(13, 8);
  buf.write("IHDR", 12);
  buf.writeUInt32BE(width, 16);
  buf.writeUInt32BE(height, 20);
  return buf.toString("base64");
}

try {
  // Aucun compte: on le dit avant d'examiner quoi que ce soit.
  assert.equal((await post({ png: png(64, 64) }))[0], 409);

  mkdirSync(paranoiaDataDir(), { recursive: true });
  writeFileSync(
    join(paranoiaDataDir(), "accounts.json"),
    JSON.stringify([
      {
        id: "test",
        minecraftUuid: "00000000-0000-0000-0000-000000000001",
        minecraftUsername: "Testeur",
        skinUrl: "",
        accessToken: "faux",
        refreshToken: "faux",
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      },
    ]),
  );

  assert.equal((await post({}))[0], 400, "ni image ni pseudo");
  assert.equal((await post({ png: Buffer.from("hello").toString("base64") }))[0], 422, "pas un PNG");
  assert.equal((await post({ png: png(128, 128) }))[0], 422, "mauvaises dimensions");
  assert.equal((await post({ variant: "autre", png: png(64, 64) }))[0], 400, "variante inconnue");

  console.log("OK test-skins");
} finally {
  server.close();
  rmSync(dataHome, { recursive: true, force: true });
}

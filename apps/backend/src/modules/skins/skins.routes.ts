import { Router } from "express";
import { z } from "zod";

import { listAccounts, updateAccountSkin } from "../auth/accounts.store.js";
import { EchecRenouvellement } from "../auth/auth.microsoft.js";
import { sessionUtilisable } from "../auth/auth.session.js";

/**
 * Changement de skin sur le compte Minecraft.
 *
 * <p>Le jeton reste dans le sidecar: la webview envoie l'image, et c'est ici
 * qu'on parle a Mojang. Le skin change reellement sur le compte, donc partout
 * -- pas seulement dans ce launcher.
 */
export const skinsRouter = Router();

const PROFILE_URL = "https://api.minecraftservices.com/minecraft/profile";
const SKINS_URL = `${PROFILE_URL}/skins`;

/** Un skin fait quelques Ko; Mojang refuse au-dela de 24 Ko. */
const MAX_SKIN_BYTES = 24 * 1024;

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

class SkinError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Verifie qu'il s'agit bien d'un skin avant de le faire partir chez Mojang.
 *
 * <p>Mojang repond 400 sans dire pourquoi; mieux vaut dire au joueur que son
 * image fait 128x128 que de lui renvoyer « Reponse 400 ».
 */
function validateSkinPng(png: Buffer): void {
  if (png.length > MAX_SKIN_BYTES) {
    throw new SkinError(413, "Image trop lourde: un skin pese moins de 24 Ko.");
  }
  if (png.length < 24 || !png.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new SkinError(422, "Ce fichier n'est pas une image PNG.");
  }

  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  // 64x64 (moderne) ou 64x32 (ancien format).
  if (width !== 64 || (height !== 64 && height !== 32)) {
    throw new SkinError(422, `Dimensions invalides (${width}x${height}): un skin fait 64x64 ou 64x32.`);
  }
}

async function accountFor(accountId: unknown) {
  const id =
    typeof accountId === "string" && accountId ? accountId : listAccounts()[0]?.id;
  if (!id) {
    throw new SkinError(409, "Aucun compte Minecraft connecte");
  }

  try {
    const account = await sessionUtilisable(id);
    if (!account) {
      throw new SkinError(404, "Compte introuvable");
    }
    return account;
  } catch (err) {
    if (err instanceof EchecRenouvellement) {
      throw new SkinError(401, "Session expiree. Reconnecte ton compte dans le launcher.");
    }
    throw err;
  }
}

async function mojang(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<any> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20_000),
    headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });

  if (!response.ok) {
    let detail = `Mojang a refuse la demande (${response.status}).`;
    try {
      const body = (await response.json()) as { errorMessage?: string };
      if (body.errorMessage) detail = body.errorMessage;
    } catch {
      // Corps absent: le code suffit.
    }
    throw new SkinError(response.status === 401 ? 401 : 502, detail);
  }
  return response.status === 204 ? null : response.json().catch(() => null);
}

function fail(res: any, next: any, err: unknown) {
  if (err instanceof SkinError) {
    return res.status(err.status).json({ message: err.message });
  }
  return next(err);
}

/** Le skin actif et les capes du compte, tels que Mojang les voit. */
skinsRouter.get("/current", async (req, res, next) => {
  try {
    const account = await accountFor(req.query.accountId);
    const profile = await mojang(account.accessToken, PROFILE_URL);
    const active = (profile?.skins ?? []).find((s: any) => s.state === "ACTIVE");
    res.json({
      skin: active ? { url: active.url, variant: String(active.variant).toLowerCase() } : null,
    });
  } catch (err) {
    fail(res, next, err);
  }
});

const uploadSchema = z.object({
  accountId: z.string().optional(),
  variant: z.enum(["classic", "slim"]).default("classic"),
  /** PNG en base64, sans prefixe data:. */
  png: z.string().min(1).max(40_000).optional(),
  /** Alternative: un pseudo dont on reprend le skin. */
  username: z.string().regex(/^[A-Za-z0-9_]{1,16}$/).optional(),
});

skinsRouter.post("/", async (req, res, next) => {
  try {
    const input = uploadSchema.parse(req.body);
    if (!input.png && !input.username) {
      throw new SkinError(400, "Envoie une image PNG ou un pseudo.");
    }
    const account = await accountFor(input.accountId);

    let png: Buffer;
    if (input.png) {
      png = Buffer.from(input.png, "base64");
    } else {
      // Skin d'un autre joueur, recupere chez Minotar puis envoye comme une image.
      const source = await fetch(`https://minotar.net/skin/${input.username}`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!source.ok) throw new SkinError(404, `Skin introuvable pour « ${input.username} ».`);
      png = Buffer.from(await source.arrayBuffer());
    }
    validateSkinPng(png);

    const form = new FormData();
    form.set("variant", input.variant);
    form.set("file", new Blob([new Uint8Array(png)], { type: "image/png" }), "skin.png");
    const profile = await mojang(account.accessToken, SKINS_URL, { method: "POST", body: form });

    const active = (profile?.skins ?? []).find((s: any) => s.state === "ACTIVE");
    if (active?.url) {
      updateAccountSkin(account.id, active.url);
    }
    res.json({ skin: active ? { url: active.url, variant: String(active.variant).toLowerCase() } : null });
  } catch (err) {
    fail(res, next, err);
  }
});

/** Retire le skin personnalise: le compte retombe sur Steve ou Alex. */
skinsRouter.delete("/", async (req, res, next) => {
  try {
    const account = await accountFor(req.query.accountId);
    await mojang(account.accessToken, `${SKINS_URL}/active`, { method: "DELETE" });
    updateAccountSkin(account.id, "");
    res.status(204).send();
  } catch (err) {
    fail(res, next, err);
  }
});

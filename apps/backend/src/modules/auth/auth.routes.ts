import { Router } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import {
  getMicrosoftAuthorizeUrl,
  completeMicrosoftCallback,
} from "./auth.microsoft.js";
import { createAuthState, consumeAuthState, safeEquals } from "./auth.state.js";

export const authRouter = Router();

const ALLOWED_REDIRECT_URIS = new Set([
  "https://login.live.com/oauth20_desktop.srf",
]);

const callbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  redirectUri: z.string().url(),
});

authRouter.get("/microsoft/url", (req, res, next) => {
  try {
    const redirectUri = req.query.redirectUri;
    if (typeof redirectUri !== "string" || redirectUri.length === 0) {
      return res.status(400).json({ message: "Missing redirectUri" });
    }

    // Sans liste blanche, n'importe qui pouvant joindre l'API pourrait faire
    // emettre une URL de connexion renvoyant le code vers son propre domaine.
    if (!ALLOWED_REDIRECT_URIS.has(redirectUri)) {
      return res.status(400).json({ message: "redirectUri not allowed" });
    }

    const state = createAuthState(redirectUri);
    return res.json(getMicrosoftAuthorizeUrl(redirectUri, state));
  } catch (err) {
    return next(err);
  }
});

authRouter.post("/microsoft/callback", async (req, res, next) => {
  try {
    const body = callbackSchema.parse(req.body);

    // Le state etait accepte sans jamais etre verifie: un code d'autorisation
    // obtenu ailleurs pouvait donc etre rejoue sur cette route.
    const issued = consumeAuthState(body.state);
    if (!issued || !safeEquals(issued.redirectUri, body.redirectUri)) {
      return res
        .status(400)
        .json({ message: "invalid or expired authentication state" });
    }

    const account = await completeMicrosoftCallback({
      code: body.code,
      state: body.state,
      redirectUri: body.redirectUri,
    });

    return res.json({
      id: crypto.randomUUID(),
      minecraftUuid: account.minecraftUuid,
      minecraftUsername: account.minecraftUsername,
      skinUrl: account.skinUrl,
      accessToken: account.minecraftAccessToken,
      refreshToken: account.microsoftRefreshToken,
      expiresAt: account.expiresAt,
    });
  } catch (err) {
    return next(err);
  }
});

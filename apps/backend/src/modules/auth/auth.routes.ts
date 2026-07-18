import { Router } from "express";
import crypto from "node:crypto";
import {
  getMicrosoftAuthorizeUrl,
  completeMicrosoftCallback,
} from "./auth.microsoft.js";

export const authRouter = Router();

authRouter.get("/microsoft/url", async (req, res, next) => {
  try {
    const redirectUri = req.query.redirectUri as string;
    if (!redirectUri) {
      return res.status(400).json({ error: "Missing redirectUri" });
    }
    const result = getMicrosoftAuthorizeUrl(redirectUri);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

authRouter.post("/microsoft/callback", async (req, res, next) => {
  try {
    const { code, state, redirectUri } = req.body;
    if (!code || !redirectUri) {
      return res.status(400).json({ error: "Missing code or redirectUri" });
    }
    const account = await completeMicrosoftCallback({
      code,
      state,
      redirectUri,
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
    console.error("\n\n====== ERREUR D'AUTHENTIFICATION MICROSOFT ======");
    console.error(err);
    console.error("==================================================\n\n");
    next(err);
  }
});

import { Router } from "express";
import { z } from "zod";
import {
  buildMicrosoftAuthorizeUrl,
  completeMicrosoftAuth,
  generatePkceChallenge,
  generatePkceVerifier
} from "./auth.microsoft";
import { consumeAuthState, createAuthState } from "./auth.state";
import { env } from "../../config/env";

export const authRouter = Router();

const redirectUriSchema = z.object({
  redirectUri: z.string().url().optional()
});

const callbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  redirectUri: z.string().url().optional()
});

authRouter.get("/microsoft/url", (req, res) => {
  const parsed = redirectUriSchema.parse({ redirectUri: req.query.redirectUri });
  const redirectUri = parsed.redirectUri ?? env.MICROSOFT_REDIRECT_URI;

  const codeVerifier = generatePkceVerifier();
  const codeChallenge = generatePkceChallenge(codeVerifier);
  const state = createAuthState(codeVerifier);

  res.json({
    state,
    redirectUri,
    authorizeUrl: buildMicrosoftAuthorizeUrl({
      state,
      codeChallenge,
      redirectUri
    })
  });
});

authRouter.post("/microsoft/callback", async (req, res) => {
  const body = callbackSchema.parse(req.body);
  const codeVerifier = consumeAuthState(body.state);
  if (!codeVerifier) {
    return res.status(400).json({ message: "invalid or expired state" });
  }

  const redirectUri = body.redirectUri ?? env.MICROSOFT_REDIRECT_URI;
  const account = await completeMicrosoftAuth({
    code: body.code,
    codeVerifier,
    redirectUri
  });

  return res.json({
    id: body.state,
    minecraftUuid: account.minecraftUuid,
    minecraftUsername: account.minecraftUsername,
    skinUrl: account.skinUrl,
    accessToken: account.minecraftAccessToken,
    refreshToken: account.microsoftRefreshToken,
    expiresAt: account.expiresAt
  });
});

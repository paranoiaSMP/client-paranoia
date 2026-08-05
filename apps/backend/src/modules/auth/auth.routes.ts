import { Router } from "express";
import { z } from "zod";
import {
  getMicrosoftAuthorizeUrl,
  completeMicrosoftCallback,
  refreshMicrosoftAccount,
} from "./auth.microsoft.js";
import { createAuthState, consumeAuthState, safeEquals } from "./auth.state.js";
import {
  deleteAccount,
  getAccount,
  isExpired,
  listAccounts,
  saveAccount,
  type StoredAccount,
} from "./accounts.store.js";

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

    const tokens = await completeMicrosoftCallback({
      code: body.code,
      state: body.state,
      redirectUri: body.redirectUri,
    });

    // Le compte est ecrit sur disque: sans ca il fallait repasser par la
    // fenetre Microsoft a chaque demarrage du launcher.
    return res.json(saveAccount(tokens));
  } catch (err) {
    return next(err);
  }
});

/** Comptes deja connectes, restaures au demarrage du launcher. */
authRouter.get("/accounts", (_req, res) => {
  return res.json(listAccounts());
});

authRouter.delete("/accounts/:id", (req, res) => {
  if (!deleteAccount(req.params.id)) {
    return res.status(404).json({ message: "account not found" });
  }
  return res.status(204).send();
});

/**
 * Return a usable session for this account, renewing it through the Microsoft
 * refresh token when the Minecraft one has expired.
 */
authRouter.post("/accounts/:id/refresh", async (req, res, next) => {
  try {
    const account = getAccount(req.params.id);
    if (!account) {
      return res.status(404).json({ message: "account not found" });
    }

    if (!isExpired(account)) {
      return res.json(account);
    }

    let refreshed: StoredAccount;
    try {
      refreshed = saveAccount(await refreshMicrosoftAccount(account.refreshToken));
    } catch {
      // Le refresh token de Microsoft a une duree de vie limitee: une fois
      // perime, seule une reconnexion complete peut rendre la main.
      deleteAccount(account.id);
      return res
        .status(401)
        .json({ message: "session expired, sign in again" });
    }

    return res.json(refreshed);
  } catch (err) {
    return next(err);
  }
});

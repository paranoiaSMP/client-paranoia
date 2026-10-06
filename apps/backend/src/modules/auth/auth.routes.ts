import { Router } from "express";
import { z } from "zod";
import {
  getMicrosoftAuthorizeUrl,
  completeMicrosoftCallback,
  EchecRenouvellement,
} from "./auth.microsoft.js";
import { sessionUtilisable } from "./auth.session.js";
import { createAuthState, consumeAuthState, safeEquals } from "./auth.state.js";
import {
  activeAccountId,
  deleteAccount,
  listAccounts,
  saveAccount,
  setActiveAccountId,
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

/**
 * Les memes comptes, sans un seul secret.
 *
 * <p>La route ci-dessus rend les jetons: celui de Minecraft, vivant, et celui
 * de renouvellement Microsoft, qui vaut un compte entier. C'est ce qu'il faut
 * a l'interface du launcher, qui lance le jeu avec. Ce n'est pas ce qu'il faut
 * au mod en jeu, qui ne veut qu'afficher des pseudonymes -- et qui tourne dans
 * un processus partage avec tous les mods que le joueur a installes.
 *
 * <p>Deux routes plutot qu'une, donc, et celle-ci ne porte rien qu'on
 * regretterait de voir passer.
 */
authRouter.get("/accounts/summary", (_req, res) => {
  const actif = activeAccountId();
  return res.json(
    listAccounts().map((compte) => ({
      id: compte.id,
      minecraftUsername: compte.minecraftUsername,
      minecraftUuid: compte.minecraftUuid,
      active: compte.id === actif,
    })),
  );
});

/**
 * Le compte a utiliser au prochain lancement.
 *
 * <p>Ne change rien a la partie en cours: la session de Minecraft est fixee au
 * demarrage du jeu. C'est un choix enregistre, que le launcher relira.
 */
authRouter.put("/accounts/:id/active", (req, res) => {
  if (!setActiveAccountId(req.params.id)) {
    return res.status(404).json({ message: "account not found" });
  }
  return res.status(204).send();
});

/** Le compte choisi, ou null si aucun ne l'a encore ete. */
authRouter.get("/accounts/active", (_req, res) => {
  return res.json({ id: activeAccountId() });
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
    const session = await sessionUtilisable(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "account not found" });
    }
    return res.json(session);
  } catch (err) {
    // Deux echecs tres differents, et les confondre coutait une reconnexion.
    //
    // Microsoft refuse le jeton (`invalid_grant`): le compte a ete oublie, il
    // faut repasser par la fenetre de connexion. C'est un 401, et l'interface
    // ramene le joueur a l'ecran de connexion.
    //
    // Tout le reste -- Xbox Live en panne, reseau pas encore la, 500 passager
    // -- laisse le compte en place. C'est un 503: l'interface le garde, le dit,
    // et reessaiera. Le joueur n'a rien a faire.
    if (err instanceof EchecRenouvellement) {
      if (err.definitif) {
        return res
          .status(401)
          .json({ message: "session expired, sign in again" });
      }
      return res.status(503).json({
        message: `session non renouvelee: ${err.message}`,
        retriable: true,
      });
    }
    return next(err);
  }
});

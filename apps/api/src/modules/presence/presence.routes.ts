import { Router } from "express";

import { env } from "../../config/env.js";
import { requireToken } from "../auth/requireToken.js";
import { onlineCount, touch } from "./presence.store.js";

export const presenceRouter = Router();

/**
 * Le mod signale qu'il est toujours la.
 *
 * <p>L'UUID vient du jeton, jamais du corps de la requete: c'est ce qui
 * empeche un client de declarer la presence de quelqu'un d'autre.
 */
presenceRouter.post("/heartbeat", requireToken, (req, res) => {
  touch(req.profile!.uuid);

  // L'intervalle est dicte par le serveur pour qu'on puisse l'allonger si la
  // charge monte, sans republier une version du mod.
  res.json({ intervalSeconds: env.HEARTBEAT_INTERVAL_SECONDS });
});

/** Compteur public, sans identifiants: utile pour le launcher et les stats. */
presenceRouter.get("/count", (_req, res) => {
  res.json({ online: onlineCount() });
});

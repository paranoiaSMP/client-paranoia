import pino from "pino";
import type { IncomingMessage, ServerResponse } from "node:http";
import { pinoHttp } from "pino-http";

import { env } from "../config/env.js";

export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
});

/**
 * Journalisation volontairement aveugle au contenu des requetes.
 *
 * <p>La route de lookup recoit la liste des joueurs qu'un utilisateur a sous
 * les yeux. La journaliser reconstituerait, ligne apres ligne, qui joue avec
 * qui et sur quel serveur -- exactement ce qu'on a promis de ne pas savoir.
 * On ne garde donc que methode, chemin et code de reponse.
 *
 * <p>Les corps de requete ne sont de toute facon pas journalises par
 * `pino-http`, mais s'en remettre a un defaut qu'une mise a jour peut changer
 * serait imprudent pour une donnee de cette nature: les serialiseurs
 * ci-dessous rendent l'omission explicite.
 */
export const httpLogger = pinoHttp({
  logger,
  serializers: {
    req: (req: IncomingMessage) => ({ method: req.method, path: req.url?.split("?")[0] }),
    res: (res: ServerResponse) => ({ statusCode: res.statusCode }),
  },
});

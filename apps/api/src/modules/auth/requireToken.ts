import type { NextFunction, Request, Response } from "express";

import type { VerifiedProfile } from "./mojang.js";
import { resolveToken } from "./tokens.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      profile?: VerifiedProfile;
    }
  }
}

/**
 * Exige un jeton valide, et attache le profil verifie a la requete.
 *
 * <p>Applique aussi au lookup, pas seulement aux ecritures: sans cela,
 * n'importe qui pourrait interroger l'API pour savoir si tel joueur utilise
 * Paranoia, ce qui en ferait un service de tracage pour les autres.
 */
export function requireToken(req: Request, res: Response, next: NextFunction): void {
  const header = req.get("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Jeton absent" });
    return;
  }

  const profile = resolveToken(header.slice("Bearer ".length).trim());
  if (!profile) {
    // 401 et non 403: le mod doit comprendre qu'il faut refaire le handshake,
    // ce qui arrive normalement apres un redemarrage du service.
    res.status(401).json({ error: "Jeton invalide ou expire" });
    return;
  }

  req.profile = profile;
  next();
}

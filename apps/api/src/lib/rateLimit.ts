import type { NextFunction, Request, Response } from "express";

interface Window {
  count: number;
  resetAt: number;
}

/**
 * Limite de debit par IP, en fenetre fixe.
 *
 * <p>Ecrite ici plutot que tiree d'une dependance: le besoin tient en trente
 * lignes, et ce service est expose a Internet -- chaque paquet supplementaire
 * est une surface a surveiller pour un gain nul.
 *
 * <p>Fenetre fixe et non glissante, en toute connaissance de cause: un client
 * peut emettre deux fois le quota a cheval sur deux fenetres. Face a un mod
 * qui envoie une requete toutes les trente secondes, cette imprecision n'a
 * aucune consequence, et une fenetre glissante couterait un tableau
 * d'horodatages par IP.
 */
export function rateLimit(perMinute: number) {
  const windows = new Map<string, Window>();

  // Sans balayage, la table grossit d'une entree par IP vue depuis le
  // demarrage: sur un service public, c'est une fuite de memoire lente mais
  // certaine.
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, window] of windows) {
      if (window.resetAt <= now) {
        windows.delete(key);
      }
    }
  }, 60_000);
  sweep.unref();

  return function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = req.ip ?? "inconnu";
    const now = Date.now();
    const window = windows.get(key);

    if (!window || window.resetAt <= now) {
      windows.set(key, { count: 1, resetAt: now + 60_000 });
      next();
      return;
    }

    window.count += 1;
    if (window.count > perMinute) {
      res
        .status(429)
        .set("Retry-After", String(Math.ceil((window.resetAt - now) / 1000)))
        .json({ error: "Trop de requetes" });
      return;
    }

    next();
  };
}

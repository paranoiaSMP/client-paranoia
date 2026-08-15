import { Router } from "express";

import { catalogItems } from "./cosmetics.store.js";

export const cosmeticsRouter = Router();

/**
 * Catalogue complet, sans identifiants de joueurs.
 *
 * <p>Public: c'est une vitrine, la boutique et le launcher l'affichent avant
 * toute connexion. Qui possede quoi ne s'obtient que par le lookup, avec un
 * jeton.
 */
cosmeticsRouter.get("/catalog", (_req, res) => {
  // Une minute de cache: le fichier change quelques fois par semaine, et le
  // catalogue est la reponse la plus demandee du service.
  res.set("Cache-Control", "public, max-age=60");
  res.json(catalogItems());
});

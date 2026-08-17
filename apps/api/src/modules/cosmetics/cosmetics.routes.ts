import { Router } from "express";
import { z } from "zod";

import { requireToken } from "../auth/requireToken.js";
import {
  balanceOf,
  catalogItems,
  equippedFor,
  isAdmin,
  itemById,
  ownedBy,
} from "./cosmetics.store.js";
import { mutate } from "./state.store.js";

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

/** Etat du joueur connecte: solde, possessions, equipement. */
cosmeticsRouter.get("/me", requireToken, (req, res) => {
  const uuid = req.profile!.uuid;

  res.json({
    uuid,
    username: req.profile!.username,
    // null et non un grand nombre: le vestiaire affiche l'infini plutot
    // qu'un solde qui n'aurait aucun sens a decompter.
    balance: balanceOf(uuid),
    admin: isAdmin(uuid),
    owned: ownedBy(uuid),
    equipped: equippedFor(uuid),
  });
});

const purchaseSchema = z.object({ id: z.string().min(1) });

/**
 * Achete un cosmetique.
 *
 * <p>Le prix est lu dans le catalogue, jamais recu du client: sinon
 * n'importe qui pourrait acheter une cape legendaire pour zero paracoin en
 * modifiant sa requete.
 */
cosmeticsRouter.post("/purchase", requireToken, (req, res) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const uuid = req.profile!.uuid;
  const item = itemById(parsed.data.id);
  if (!item) {
    res.status(404).json({ error: "Cosmetique inconnu" });
    return;
  }

  if (ownedBy(uuid).includes(item.id)) {
    // Deja possede: on repond 200 sans rien debiter. Un double clic ne doit
    // pas faire payer deux fois.
    res.json({ balance: balanceOf(uuid), owned: ownedBy(uuid), deja: true });
    return;
  }

  const admin = isAdmin(uuid);
  const balance = balanceOf(uuid);

  if (!admin && (balance ?? 0) < item.price) {
    res.status(402).json({ error: "Paracoins insuffisants", balance, price: item.price });
    return;
  }

  mutate(uuid, (current) => ({
    ...current,
    // Un admin n'est jamais debite: son solde reste illimite, et aucun
    // compteur ne derive derriere son dos.
    spent: admin ? current.spent : current.spent + item.price,
    owned: [...current.owned, item.id],
  }));

  res.json({ balance: balanceOf(uuid), owned: ownedBy(uuid) });
});

const equipSchema = z.object({ ids: z.array(z.string()).max(16) });

/**
 * Remplace ce que porte le joueur.
 *
 * <p>Un seul objet par type: porter deux capes n'a pas de sens, et laisser
 * passer la liste telle quelle ferait dependre le rendu de l'ordre d'envoi.
 */
cosmeticsRouter.put("/equipped", requireToken, (req, res) => {
  const parsed = equipSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const uuid = req.profile!.uuid;
  const owned = new Set(ownedBy(uuid));
  const parType = new Map<string, string>();

  for (const id of parsed.data.ids) {
    const item = itemById(id);
    if (!item) {
      res.status(404).json({ error: `Cosmetique inconnu: ${id}` });
      return;
    }
    if (!owned.has(id)) {
      res.status(403).json({ error: `Cosmetique non possede: ${id}` });
      return;
    }
    parType.set(item.type, id);
  }

  mutate(uuid, (current) => ({ ...current, equipped: [...parType.values()] }));
  res.json({ equipped: equippedFor(uuid) });
});

/** Retire tout, ou seulement un type. */
cosmeticsRouter.delete("/equipped", requireToken, (req, res) => {
  const uuid = req.profile!.uuid;
  const type = typeof req.query.type === "string" ? req.query.type : null;

  const kept = type
    ? equippedFor(uuid).filter((id) => itemById(id)?.type !== type)
    : [];

  mutate(uuid, (current) => ({ ...current, equipped: kept }));
  res.json({ equipped: equippedFor(uuid) });
});

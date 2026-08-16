import { Router } from "express";
import { z } from "zod";

import { listAccounts, type StoredAccount } from "../auth/accounts.store.js";
import {
  fetchCatalog,
  fetchProfile,
  ParanoiaApiError,
  purchase,
  setEquipped,
} from "./paranoiaApi.js";

export const cosmeticsRouter = Router();

/**
 * Le compte pour lequel repondre.
 *
 * <p>Le launcher passe `accountId` quand plusieurs comptes sont enregistres.
 * Avec un seul, on l'utilise sans le demander -- le vestiaire n'a pas a
 * connaitre un identifiant interne pour afficher une garde-robe.
 */
function resolveAccount(accountId: unknown): StoredAccount | null {
  const accounts = listAccounts();
  if (typeof accountId === "string" && accountId.length > 0) {
    return accounts.find((account) => account.id === accountId) ?? null;
  }
  return accounts[0] ?? null;
}

/** Traduit un echec du service heberge en reponse locale exploitable. */
function fail(res: Parameters<Parameters<Router["get"]>[1]>[1], err: unknown): void {
  if (err instanceof ParanoiaApiError) {
    // 402 (paracoins insuffisants) et 403 (non possede) sont des reponses
    // metier, pas des pannes: on les transmet telles quelles pour que
    // l'interface affiche la bonne phrase.
    res.status(err.status === 401 ? 502 : err.status).json({ error: err.message });
    return;
  }

  res.status(502).json({
    error: "Service Paranoia injoignable. Reessaie dans un instant.",
  });
}

cosmeticsRouter.get("/catalog", async (_req, res) => {
  try {
    res.json(await fetchCatalog());
  } catch (err) {
    fail(res, err);
  }
});

/** Solde, possessions et equipement du joueur connecte. */
cosmeticsRouter.get("/me", async (req, res) => {
  const account = resolveAccount(req.query.accountId);
  if (!account) {
    res.status(409).json({ error: "Aucun compte Minecraft connecte" });
    return;
  }

  try {
    res.json(await fetchProfile(account));
  } catch (err) {
    fail(res, err);
  }
});

const purchaseSchema = z.object({ id: z.string().min(1), accountId: z.string().optional() });

cosmeticsRouter.post("/purchase", async (req, res) => {
  const parsed = purchaseSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const account = resolveAccount(parsed.data.accountId);
  if (!account) {
    res.status(409).json({ error: "Aucun compte Minecraft connecte" });
    return;
  }

  try {
    res.json(await purchase(account, parsed.data.id));
  } catch (err) {
    fail(res, err);
  }
});

const equipSchema = z.object({
  ids: z.array(z.string()).max(16),
  accountId: z.string().optional(),
});

cosmeticsRouter.put("/equipped", async (req, res) => {
  const parsed = equipSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const account = resolveAccount(parsed.data.accountId);
  if (!account) {
    res.status(409).json({ error: "Aucun compte Minecraft connecte" });
    return;
  }

  try {
    res.json(await setEquipped(account, parsed.data.ids));
  } catch (err) {
    fail(res, err);
  }
});

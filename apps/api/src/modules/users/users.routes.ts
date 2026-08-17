import { Router } from "express";
import { z } from "zod";

import { env } from "../../config/env.js";
import { normalizeUuid } from "../../lib/uuid.js";
import { requireToken } from "../auth/requireToken.js";
import { equippedFor } from "../cosmetics/cosmetics.store.js";
import { isOnline } from "../presence/presence.store.js";

export const usersRouter = Router();

const lookupSchema = z.object({
  uuids: z.array(z.string()).max(env.LOOKUP_MAX_UUIDS),
});

/**
 * Parmi ces joueurs, lesquels utilisent Paranoia -- et que portent-ils ?
 *
 * <p>Le mod envoie les identifiants qu'il a sous les yeux et reçoit la
 * reponse pour ceux-la uniquement. Il n'existe aucune route qui liste les
 * utilisateurs: on ne peut pas se procurer l'annuaire, seulement verifier des
 * noms qu'on connait deja.
 *
 * <p>Cette route ne journalise rien de son corps (voir `lib/logger.ts`).
 * L'API voit passer la question, ne la garde pas, et n'en tire aucun etat.
 */
usersRouter.post("/lookup", requireToken, (req, res) => {
  const parsed = lookupSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  const users: string[] = [];
  const cosmetics: Record<string, string[]> = {};

  // Un ensemble plutot que la liste brute: un client qui repete mille fois le
  // meme identifiant ne doit pas faire mille recherches.
  const asked = new Set<string>();
  for (const raw of parsed.data.uuids) {
    const uuid = normalizeUuid(raw);
    if (uuid) {
      asked.add(uuid);
    }
  }

  for (const uuid of asked) {
    if (!isOnline(uuid)) {
      continue;
    }

    users.push(uuid);

    // Les cosmetiques ne sortent que pour un joueur en ligne et interroge.
    // Repondre pour un joueur hors ligne transformerait la route en annuaire
    // consultable de qui possede quoi.
    const worn = equippedFor(uuid);
    if (worn.length > 0) {
      cosmetics[uuid] = worn;
    }
  }

  // `users` garde exactement la forme que le mod lisait quand la liste venait
  // d'un plugin serveur, ce qui laisse `ParanoiaUsers.apply` inchange.
  res.json({ users, cosmetics });
});

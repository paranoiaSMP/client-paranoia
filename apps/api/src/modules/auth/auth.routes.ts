import { Router } from "express";
import { z } from "zod";

import { verifySession } from "./mojang.js";
import { consumeChallenge, issueChallenge, issueToken } from "./tokens.js";

export const authRouter = Router();

/**
 * Etape 1 du handshake: le mod demande un defi.
 *
 * <p>Il enchaine en appelant `join` chez Mojang avec ce `serverId`, puis
 * revient sur `/complete`. Rien n'est authentifie ici -- un defi seul ne
 * donne acces a rien.
 */
authRouter.post("/begin", (_req, res) => {
  res.json({ serverId: issueChallenge() });
});

const completeSchema = z.object({
  username: z.string().min(1).max(16),
  serverId: z.string().regex(/^[0-9a-f]{32}$/),
});

/** Etape 2: Mojang confirme, on emet le jeton. */
authRouter.post("/complete", async (req, res) => {
  const parsed = completeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Requete invalide" });
    return;
  }

  if (!consumeChallenge(parsed.data.serverId)) {
    res.status(400).json({ error: "Defi inconnu ou expire" });
    return;
  }

  const profile = await verifySession(parsed.data.username, parsed.data.serverId);
  if (!profile) {
    res.status(401).json({ error: "Session Mojang non confirmee" });
    return;
  }

  const { token, expiresIn } = issueToken(profile);
  res.json({ token, expiresIn, uuid: profile.uuid, username: profile.username });
});

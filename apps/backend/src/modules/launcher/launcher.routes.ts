import { Router } from "express";
import { z } from "zod";
import { launchMinecraft, getLaunchStatus } from "./launcher.service";

export const launcherRouter = Router();

const playSchema = z.object({
  profileId: z.string().min(1),
  minecraftVersion: z.string().min(1),
  ramMb: z.number().int().positive(),
  account: z.object({
    minecraftUuid: z.string(),
    minecraftUsername: z.string(),
    accessToken: z.string(),
  }),
});

/*
 * ROUTES API DU LAUNCHER
 * - POST /play : Initialise le processus de lancement en arriere-plan sans bloquer la requete HTTP.
 * - GET /status/:profileId : Retourne l'etat actuel du lancement (progression, etape).
 */
launcherRouter.post("/play", async (req, res, next) => {
  try {
    const body = playSchema.parse(req.body);
    launchMinecraft(
      body.profileId,
      body.minecraftVersion,
      body.ramMb,
      body.account,
    ).catch((err) => {
      console.error("[Launcher] Game launch failed:", err);
    });

    res.json({ status: "launching" });
  } catch (err) {
    next(err);
  }
});

launcherRouter.get("/status/:profileId", (req, res) => {
  const status = getLaunchStatus(req.params.profileId);
  res.json(status);
});

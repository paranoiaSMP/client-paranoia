import { Router } from "express";
import { z } from "zod";
import { launchMinecraft, getLaunchStatus, cancelLaunch, setLaunchStatus } from "./launcher.service.js";
import { env } from "../config/env.js";

export const launcherRouter = Router();

const playSchema = z.object({
  profileId: z.string().min(1),
  minecraftVersion: z.string().min(1),
  ramMb: z.number().int().positive(),
  account: z.object({
    minecraftUuid: z.string(),
    minecraftUsername: z.string(),
    accessToken: z.string()
  })
});

launcherRouter.post("/play", async (req, res, next) => {
  try {
    const body = playSchema.parse(req.body);
    
    // Check ban status
    try {
      const banCheckUrl = `${env.BAN_API_URL}/api/bans/check?uuid=${encodeURIComponent(body.account.minecraftUuid)}&username=${encodeURIComponent(body.account.minecraftUsername)}`;
      const resBan = await fetch(banCheckUrl);
      if (resBan.ok) {
        const banData = await resBan.json();
        if (banData.banned) {
          setLaunchStatus(body.profileId, { state: "error", progress: 0, text: banData.message || "Vous êtes banni du launcher." });
          return res.status(403).json({ message: banData.message || "Vous êtes banni du launcher." });
        }
      } else {
        console.warn("[Launcher] Could not check ban status, proceeding with launch", resBan.status);
      }
    } catch (fetchErr) {
      console.error("[Launcher] Failed to reach BAN_API_URL for ban check:", fetchErr);
    }

    // We don't await the launch here because it takes a long time and stays open
    // We just start the process and return success
    launchMinecraft(
      body.profileId, 
      body.minecraftVersion, 
      body.ramMb, 
      body.account
    ).catch((err: any) => {
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

launcherRouter.post("/cancel/:profileId", (req, res) => {
  cancelLaunch(req.params.profileId);
  res.json({ status: "canceled" });
});

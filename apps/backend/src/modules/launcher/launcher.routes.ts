import { Router } from "express";
import { z } from "zod";
import { launchMinecraft, getLaunchStatus, stopMinecraft } from "./launcher.service.js";

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

launcherRouter.post("/stop/:profileId", (req, res) =>
   {
    const sucess = stopMinecraft(req.params.profileId);
    res.json({ success: sucess });
  

  });
import { Router } from "express";
import type { ServerStatus } from "@paranoia/contracts";

export const serverStatusRouter = Router();

serverStatusRouter.get("/", (_req, res) => {
  const status: ServerStatus = {
    online: true,
    motd: "Paranoia Network",
    pingMs: 28,
    playerCount: 124,
    maxPlayers: 1200,
  };

  res.json(status);
});

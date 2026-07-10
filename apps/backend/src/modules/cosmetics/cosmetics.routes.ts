import { Router } from "express";
import type { CosmeticItem } from "@paranoia/contracts";

export const cosmeticsRouter = Router();

cosmeticsRouter.get("/catalog", (_req, res) => {
  const items: CosmeticItem[] = [];
  res.json(items);
});

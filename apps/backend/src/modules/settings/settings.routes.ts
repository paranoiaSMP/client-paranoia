import { Router } from "express";
import { readSettings, writeSettings } from "./settings.store.js";

export const settingsRouter = Router();

settingsRouter.get("/", (_req, res) => {
  res.json(readSettings());
});

settingsRouter.put("/", (req, res) => {
  res.json(writeSettings(req.body));
});

import { Router } from "express";
import { z } from "zod";
import { exportProfile } from "../profiles/profiles.store.js";
import {
  installMod,
  listInstalledMods,
  listProjectVersions,
  removeMod,
  searchMods,
} from "./modrinth.service.js";

export const modsRouter = Router();

const searchSchema = z.object({
  query: z.string().max(120).default(""),
  gameVersion: z.string().max(32).optional(),
  loader: z.string().max(32).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(1000).default(0),
});

const installSchema = z.object({
  profileId: z.string().min(1),
  projectId: z.string().min(1),
  versionId: z.string().min(1),
  // Servent a choisir la bonne version des dependances requises.
  gameVersion: z.string().max(32).optional(),
  loader: z.string().max(32).optional(),
});

modsRouter.get("/search", async (req, res, next) => {
  try {
    const params = searchSchema.parse(req.query);
    return res.json(await searchMods(params));
  } catch (err) {
    return next(err);
  }
});

modsRouter.get("/projects/:projectId/versions", async (req, res, next) => {
  try {
    const gameVersion =
      typeof req.query.gameVersion === "string" ? req.query.gameVersion : undefined;
    const loader =
      typeof req.query.loader === "string" ? req.query.loader : undefined;

    return res.json(
      await listProjectVersions(req.params.projectId, { gameVersion, loader }),
    );
  } catch (err) {
    return next(err);
  }
});

modsRouter.post("/install", async (req, res, next) => {
  try {
    const body = installSchema.parse(req.body);

    // Le mod atterrit dans le dossier du profil: il doit exister, sinon on
    // creerait une instance orpheline au premier telechargement.
    if (!exportProfile(body.profileId)) {
      return res.status(404).json({ message: "profile not found" });
    }

    return res.status(201).json(await installMod(body));
  } catch (err) {
    return next(err);
  }
});

modsRouter.get("/installed/:profileId", async (req, res, next) => {
  try {
    if (!exportProfile(req.params.profileId)) {
      return res.status(404).json({ message: "profile not found" });
    }
    return res.json(await listInstalledMods(req.params.profileId));
  } catch (err) {
    return next(err);
  }
});

modsRouter.delete("/installed/:profileId/:fileName", async (req, res, next) => {
  try {
    const removed = await removeMod(req.params.profileId, req.params.fileName);
    if (!removed) {
      return res.status(404).json({ message: "mod not found" });
    }
    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
});

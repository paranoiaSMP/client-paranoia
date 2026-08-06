import { Router } from "express";
import { z } from "zod";
import { ensureInstanceLayout, instanceDir } from "../launcher/paths.js";
import {
  createProfile,
  deleteProfile,
  duplicateProfile,
  exportProfile,
  importProfile,
  listProfiles,
  setFavorite,
  updateProfile,
} from "./profiles.store.js";

export const profilesRouter = Router();

const profileCreateSchema = z.object({
  name: z.string().min(1).max(64),
  minecraftVersion: z.string().min(1),
  profileTypeId: z.string().min(1),
  graphicsModeId: z.string().min(1),
  ramMb: z.number().int().min(1024).max(65536).default(4096),
  resolution: z.string().min(3).max(32).default("1920x1080"),
});

const profilePatchSchema = profileCreateSchema.partial();

profilesRouter.get("/", (_req, res) => {
  res.json(listProfiles());
});

profilesRouter.post("/", async (req, res, next) => {
  try {
    const input = profileCreateSchema.parse(req.body);
    const profile = createProfile(input);
    await ensureInstanceLayout(profile.id);
    return res.status(201).json(profile);
  } catch (err) {
    return next(err);
  }
});

/** Chemin du dossier de l'instance, pour l'ouvrir depuis le launcher. */
profilesRouter.get("/:id/folder", async (req, res) => {
  const profile = exportProfile(req.params.id);
  if (!profile) {
    return res.status(404).json({ message: "profile not found" });
  }

  await ensureInstanceLayout(profile.id);
  return res.json({ path: instanceDir(profile.id) });
});

profilesRouter.patch("/:id", (req, res) => {
  const patch = profilePatchSchema.parse(req.body) as any;
  const profile = updateProfile(req.params.id, patch);
  if (!profile) {
    return res.status(404).json({ message: "profile not found" });
  }

  return res.json(profile);
});

profilesRouter.delete("/:id", (req, res) => {
  const deleted = deleteProfile(req.params.id);
  if (!deleted) {
    return res.status(404).json({ message: "profile not found" });
  }

  return res.status(204).send();
});

profilesRouter.post("/:id/duplicate", async (req, res, next) => {
  try {
    const duplicated = duplicateProfile(req.params.id);
    if (!duplicated) {
      return res.status(404).json({ message: "profile not found" });
    }

    await ensureInstanceLayout(duplicated.id);
    return res.status(201).json(duplicated);
  } catch (err) {
    return next(err);
  }
});

profilesRouter.post("/:id/favorite", (req, res) => {
  const favorite = setFavorite(req.params.id);
  if (!favorite) {
    return res.status(404).json({ message: "profile not found" });
  }

  return res.json(favorite);
});

profilesRouter.get("/:id/export", (req, res) => {
  const profile = exportProfile(req.params.id);
  if (!profile) {
    return res.status(404).json({ message: "profile not found" });
  }

  return res.json(profile);
});

profilesRouter.post("/import", async (req, res, next) => {
  try {
    const input = profileCreateSchema.parse(req.body);
    const profile = importProfile(input);
    await ensureInstanceLayout(profile.id);
    return res.status(201).json(profile);
  } catch (err) {
    return next(err);
  }
});

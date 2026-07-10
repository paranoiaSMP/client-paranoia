import { Router } from "express";
import { z } from "zod";
import {
  createProfile,
  deleteProfile,
  duplicateProfile,
  exportProfile,
  importProfile,
  listProfiles,
  setFavorite,
  updateProfile
} from "./profiles.store";

export const profilesRouter = Router();

const profileCreateSchema = z.object({
  name: z.string().min(1).max(64),
  minecraftVersion: z.string().min(1),
  profileTypeId: z.string().min(1),
  graphicsModeId: z.string().min(1),
  ramMb: z.number().int().min(1024).max(65536).default(4096),
  resolution: z.string().min(3).max(32).default("1920x1080")
});

const profilePatchSchema = profileCreateSchema.partial();

profilesRouter.get("/", (_req, res) => {
  res.json(listProfiles());
});

profilesRouter.post("/", (req, res) => {
  const input = profileCreateSchema.parse(req.body);
  const profile = createProfile(input);
  res.status(201).json(profile);
});

profilesRouter.patch("/:id", (req, res) => {
  const patch = profilePatchSchema.parse(req.body);
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

profilesRouter.post("/:id/duplicate", (req, res) => {
  const duplicated = duplicateProfile(req.params.id);
  if (!duplicated) {
    return res.status(404).json({ message: "profile not found" });
  }

  return res.status(201).json(duplicated);
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

profilesRouter.post("/import", (req, res) => {
  const input = profileCreateSchema.parse(req.body);
  const profile = importProfile(input);
  return res.status(201).json(profile);
});

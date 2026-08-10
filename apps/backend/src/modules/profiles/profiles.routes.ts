import { Router } from "express";
import { z } from "zod";
import { ensureInstanceLayout, instanceDir } from "../launcher/paths.js";
import { ensureFabricApi } from "../launcher/fabricApi.js";
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
  optionsTxtPath: z.string().optional(),
});

const profilePatchSchema = profileCreateSchema.partial();

profilesRouter.get("/", (_req, res) => {
  res.json(listProfiles());
});

/**
 * Prepare une instance neuve: arborescence, puis Fabric API.
 *
 * <p>Fabric API part en tache de fond: la creation d'un profil doit rester
 * instantanee, et elle ne doit pas echouer parce que Modrinth est lent ou
 * injoignable. Le lancement le refait de toute facon, cette fois en bloquant,
 * avec la barre de progression et un message clair en cas d'echec.
 */
async function prepareInstance(profile: { id: string; minecraftVersion: string }): Promise<void> {
  await ensureInstanceLayout(profile.id);

  void ensureFabricApi(instanceDir(profile.id), profile.minecraftVersion, () => {})
    .then((installed) => {
      console.log(
        installed
          ? `[Profils] Fabric API pret pour ${profile.id}`
          : `[Profils] pas de Fabric API pour Minecraft ${profile.minecraftVersion}`,
      );
    })
    .catch((err) => {
      // Jamais fatal ici: seul le lancement a besoin d'une garantie.
      console.warn(`[Profils] Fabric API non installe pour ${profile.id}:`, err);
    });
}

profilesRouter.post("/", async (req, res, next) => {
  try {

    console.log("CE QUE LE FRONTEND A ENVOYE :", req.body);
    const input = profileCreateSchema.parse(req.body);
    console.log("CE QUE ZOD A GARDE :", input);
    const profile = createProfile(input);
    await prepareInstance(profile);
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

    await prepareInstance(duplicated);
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
    await prepareInstance(profile);
    return res.status(201).json(profile);
  } catch (err) {
    return next(err);
  }
});

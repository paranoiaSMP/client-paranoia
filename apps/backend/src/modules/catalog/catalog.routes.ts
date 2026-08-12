import { Router } from "express";
import type {
  CreateManifestRequest,
  InstallationManifest,
  RemoteConfiguration,
  FileArtifact,
} from "@paranoia/contracts";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { minecraftReleasesOrFallback } from "./minecraftVersions.js";
import stableConfig from "../../../../../examples/remote-config/stable-config.json" with { type: "json" };
import installCatalog from "../../../../../examples/remote-config/install-catalog.json" with { type: "json" };

export const catalogRouter = Router();

const createManifestSchema = z.object({
  minecraftVersion: z.string().min(1),
  profileTypeId: z.string().min(1),
  graphicsModeId: z.string().min(1),
  locale: z.string().optional(),
});

const installCatalogSchema = z.object({
  schemaVersion: z.string(),
  entries: z.array(
    z.object({
      minecraftVersion: z.string(),
      profileTypeId: z.string(),
      graphicsModeId: z.string(),
      fabricLoaderVersion: z.string().optional(),
      requiredJavaMajor: z.number().int().positive(),
      // Sans cette declaration, zod retire la cle a la lecture: les cles
      // inconnues sont supprimees par defaut. Le mod client etait donc efface
      // du catalogue avant meme d'arriver a getManifest.
      clientMod: z
        .object({
          fileName: z.string(),
          downloadUrl: z.string().url(),
          sha256: z.string(),
          size: z.number().int().nonnegative(),
        })
        .optional(),
      artifacts: z.array(
        z.object({
          id: z.string(),
          kind: z.enum(["mod", "resource-pack", "shader", "config", "custom"]),
          fileName: z.string(),
          downloadUrl: z.string().url(),
          sha256: z.string(),
          size: z.number().int().nonnegative(),
          targetPath: z.string(),
          optional: z.boolean().optional(),
        }),
      ),
    }),
  ),
});

const validatedCatalog = installCatalogSchema.parse(installCatalog);

const base = stableConfig as RemoteConfiguration;

catalogRouter.get("/remote-config", async (_req, res, next) => {
  try {
    // La liste des versions vient de Mojang: figee dans ce fichier, elle
    // obligeait a publier un nouveau launcher a chaque sortie de Minecraft.
    const supportedMinecraftVersions = await minecraftReleasesOrFallback(
      base.supportedMinecraftVersions,
    );

    return res.json({ ...base, supportedMinecraftVersions });
  } catch (err) {
    return next(err);
  }
});

export function getManifest(
  minecraftVersion: string,
  profileTypeId: string,
  graphicsModeId: string,
): InstallationManifest {
  const match = validatedCatalog.entries.find(
    (entry) =>
      entry.minecraftVersion === minecraftVersion &&
      entry.profileTypeId === profileTypeId &&
      entry.graphicsModeId === graphicsModeId,
  );

  // Le mod client ne depend que de la version de Minecraft: un jar est compile
  // par version, pas par type de profil ni par mode graphique. Le chercher dans
  // l'entree exacte le faisait donc disparaitre des qu'un profil portait une
  // combinaison absente du catalogue -- le launcher recevait un manifeste sans
  // mod, et le jeu demarrait sans lui, sans la moindre erreur.
  const clientMod =
    match?.clientMod
    ?? validatedCatalog.entries.find(
      (entry) => entry.minecraftVersion === minecraftVersion && entry.clientMod,
    )?.clientMod;

  // Une combinaison absente du catalogue donne un manifeste vide, donc du
  // Minecraft vanilla, au lieu d'une erreur. Le catalogue sert a proposer un
  // pack pret a l'emploi, pas a autoriser une version.
  return {
    id: randomUUID(),
    minecraftVersion,
    ...(match?.fabricLoaderVersion
      ? { fabricLoaderVersion: match.fabricLoaderVersion }
      : {}),
    ...(match?.requiredJavaMajor
      ? { requiredJavaMajor: match.requiredJavaMajor }
      : {}),
    profileTypeId,
    graphicsModeId,
    // Oubli qui rendait le mod client indetectable: le manifeste est reconstruit
    // champ par champ, et celui-ci n'y figurait pas. manifest.clientMod valait
    // donc toujours undefined, quelle que soit la version.
    ...(clientMod ? { clientMod } : {}),
    artifacts: (match?.artifacts ?? []) as FileArtifact[],
    generatedAt: new Date().toISOString(),
    signature: "TODO_SIGNED_MANIFEST",
  };
}

catalogRouter.post("/manifest", (req, res) => {
  const body = createManifestSchema.parse(req.body) as CreateManifestRequest;
  res.json(
    getManifest(body.minecraftVersion, body.profileTypeId, body.graphicsModeId),
  );
});

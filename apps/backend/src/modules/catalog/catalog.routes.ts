import { Router } from "express";
import type { CreateManifestRequest, InstallationManifest, RemoteConfiguration } from "@paranoia/contracts";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import stableConfig from "../../../../../examples/remote-config/stable-config.json" assert { type: "json" };
import installCatalog from "../../../../../examples/remote-config/install-catalog.json" assert { type: "json" };

export const catalogRouter = Router();

const createManifestSchema = z.object({
  minecraftVersion: z.string().min(1),
  profileTypeId: z.string().min(1),
  graphicsModeId: z.string().min(1),
  locale: z.string().optional()
});

const installCatalogSchema = z.object({
  schemaVersion: z.string(),
  entries: z.array(
    z.object({
      minecraftVersion: z.string(),
      profileTypeId: z.string(),
      graphicsModeId: z.string(),
      fabricLoaderVersion: z.string(),
      requiredJavaMajor: z.number().int().positive(),
      artifacts: z.array(
        z.object({
          id: z.string(),
          kind: z.enum(["mod", "resource-pack", "shader", "config", "custom"]),
          fileName: z.string(),
          downloadUrl: z.string().url(),
          sha256: z.string(),
          size: z.number().int().nonnegative(),
          targetPath: z.string(),
          optional: z.boolean().optional()
        })
      )
    })
  )
});

const validatedCatalog = installCatalogSchema.parse(installCatalog);

catalogRouter.get("/remote-config", (_req, res) => {
  res.json(stableConfig as RemoteConfiguration);
});

catalogRouter.post("/manifest", (req, res) => {
  const body = createManifestSchema.parse(req.body) as CreateManifestRequest;
  const match = validatedCatalog.entries.find(
    (entry) =>
      entry.minecraftVersion === body.minecraftVersion &&
      entry.profileTypeId === body.profileTypeId &&
      entry.graphicsModeId === body.graphicsModeId
  );

  if (!match) {
    return res.status(404).json({
      message: "no installation template found for this version/type/graphics combination"
    });
  }

  const manifest: InstallationManifest = {
    id: randomUUID(),
    minecraftVersion: body.minecraftVersion,
    fabricLoaderVersion: match.fabricLoaderVersion,
    requiredJavaMajor: match.requiredJavaMajor,
    profileTypeId: body.profileTypeId,
    graphicsModeId: body.graphicsModeId,
    artifacts: match.artifacts,
    generatedAt: new Date().toISOString(),
    signature: "TODO_SIGNED_MANIFEST"
  };

  res.json(manifest);
});

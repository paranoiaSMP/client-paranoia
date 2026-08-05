import { Router } from "express";
import type {
  CreateManifestRequest,
  InstallationManifest,
  RemoteConfiguration,
  FileArtifact,
} from "@paranoia/contracts";
import { randomUUID } from "node:crypto";
import { z } from "zod";
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

catalogRouter.get("/remote-config", (_req, res) => {
  res.json(stableConfig as RemoteConfiguration);
});

export function getManifest(
  minecraftVersion: string,
  profileTypeId: string,
  graphicsModeId: string,
): InstallationManifest | null {
  const match = validatedCatalog.entries.find(
    (entry) =>
      entry.minecraftVersion === minecraftVersion &&
      entry.profileTypeId === profileTypeId &&
      entry.graphicsModeId === graphicsModeId,
  );

  if (!match) {
    return null;
  }

  return {
    id: randomUUID(),
    minecraftVersion: minecraftVersion,
    ...(match.fabricLoaderVersion
      ? { fabricLoaderVersion: match.fabricLoaderVersion }
      : {}),
    requiredJavaMajor: match.requiredJavaMajor,
    profileTypeId: profileTypeId,
    graphicsModeId: graphicsModeId,
    artifacts: match.artifacts as FileArtifact[],
    generatedAt: new Date().toISOString(),
    signature: "TODO_SIGNED_MANIFEST",
  };
}

catalogRouter.post("/manifest", (req, res) => {
  const body = createManifestSchema.parse(req.body) as CreateManifestRequest;
  const manifest = getManifest(
    body.minecraftVersion,
    body.profileTypeId,
    body.graphicsModeId
  );

  if (!manifest) {
    return res.status(404).json({
      message:
        "no installation template found for this version/type/graphics combination",
    });
  }

  res.json(manifest);
});

import { Router } from "express";
import type {
  CreateManifestRequest,
  InstallationManifest,
  RemoteConfiguration,
  FileArtifact,
  ClientModArtifact,
} from "@paranoia/contracts";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { paranoiaDataDir } from "../launcher/paths.js";
import { z } from "zod";
import {
  latestSnapshotOrNull,
  minecraftReleasesOrFallback,
} from "./minecraftVersions.js";
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

    // A part, et pas dans la liste ci-dessus: une snapshot ne se choisit pas
    // pour jouer sur un serveur, elle se choisit pour essayer la prochaine
    // version. La melanger aux releases la ferait prendre pour l'une d'elles.
    const latestSnapshot = await latestSnapshotOrNull();

    // Versions reellement couvertes par le mod, tirees du catalogue: elles
    // changent a chaque release, il ne faut pas les ecrire a la main.
    const clientModVersions = [
      ...new Set(
        validatedCatalog.entries
          .filter((entry) => entry.clientMod)
          .map((entry) => entry.minecraftVersion),
      ),
    ];

    return res.json({
      ...base,
      supportedMinecraftVersions,
      clientModVersions,
      ...(latestSnapshot ? { latestSnapshot } : {}),
    });
  } catch (err) {
    return next(err);
  }
});

function resolveLocalClientModArtifact(minecraftVersion: string): ClientModArtifact | null {
  const directory = path.join(paranoiaDataDir(), "runtime");
  let targetJar: string | null = null;

  try {
    if (fs.existsSync(directory)) {
      const files = fs.readdirSync(directory);
      const match = files.find((f) =>
        f.toLowerCase().startsWith("paranoia-client") &&
        f.toLowerCase().endsWith(".jar") &&
        !f.toLowerCase().endsWith("-sources.jar") &&
        f.includes(`+${minecraftVersion}`)
      );
      if (match) targetJar = path.join(directory, match);
    }
  } catch {
    // ignore
  }

  if (!targetJar) {
    const candidate = path.resolve(process.cwd(), "apps/client-mod/versions", minecraftVersion, "build/libs");
    try {
      if (fs.existsSync(candidate)) {
        const files = fs.readdirSync(candidate);
        const match = files.find((f) =>
          f.toLowerCase().startsWith("paranoia-client") &&
          f.toLowerCase().endsWith(".jar") &&
          !f.toLowerCase().endsWith("-sources.jar")
        );
        if (match) targetJar = path.join(candidate, match);
      }
    } catch {
      // ignore
    }
  }

  if (targetJar && fs.existsSync(targetJar)) {
    try {
      const stats = fs.statSync(targetJar);
      const hash = createHash("sha256").update(fs.readFileSync(targetJar)).digest("hex");
      const fileName = path.basename(targetJar);
      const port = process.env.PORT || 47820;
      return {
        fileName,
        downloadUrl: `http://127.0.0.1:${port}/v1/catalog/client-mod/${fileName}`,
        sha256: hash,
        size: stats.size,
      };
    } catch {
      // ignore
    }
  }

  return null;
}

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

  let clientMod =
    match?.clientMod
    ?? validatedCatalog.entries.find(
      (entry) => entry.minecraftVersion === minecraftVersion && entry.clientMod,
    )?.clientMod;

  if (!clientMod) {
    clientMod = resolveLocalClientModArtifact(minecraftVersion) ?? undefined;
  }

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
    ...(clientMod ? { clientMod } : {}),
    artifacts: (match?.artifacts ?? []) as FileArtifact[],
    generatedAt: new Date().toISOString(),
  };
}

catalogRouter.post("/manifest", (req, res) => {
  const body = createManifestSchema.parse(req.body) as CreateManifestRequest;
  res.json(
    getManifest(body.minecraftVersion, body.profileTypeId, body.graphicsModeId),
  );
});

catalogRouter.get("/client-mod/:fileName", (req, res) => {
  const fileName = path.basename(req.params.fileName);
  const runtimePath = path.join(paranoiaDataDir(), "runtime", fileName);
  if (fs.existsSync(runtimePath)) {
    return res.sendFile(runtimePath);
  }
  const match = fileName.match(/\+([^.]+)\.jar$/);
  if (match && match[1]) {
    const mcVersion = match[1];
    const buildPath = path.resolve(process.cwd(), "apps/client-mod/versions", mcVersion, "build/libs", fileName);
    if (fs.existsSync(buildPath)) {
      return res.sendFile(buildPath);
    }
  }
  res.status(404).json({ message: "Client mod introuvable" });
});

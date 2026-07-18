import { Client } from "minecraft-launcher-core";
import path from "node:path";
import os from "node:os";
import { ensureJava21 } from "./javaDownloader.js";
import { getManifest } from "../catalog/catalog.routes.js";
import { exportProfile } from "../profiles/profiles.store.js";
import { ensureFabric } from "./fabricDownloader.js";
import { downloadArtifacts } from "./artifactDownloader.js";

export type LaunchStatus = {
  state: "idle" | "downloading_java" | "downloading_assets" | "launching" | "running" | "error";
  progress: number; // 0 to 100
  text: string;
};

// We store instances and status of launchers
const activeLaunchers = new Map<string, Client>();
const launchStatuses = new Map<string, LaunchStatus>();

export function getLaunchStatus(profileId: string): LaunchStatus {
  return launchStatuses.get(profileId) || { state: "idle", progress: 0, text: "" };
}

export async function launchMinecraft(
  profileId: string,
  minecraftVersion: string,
  ramMb: number,
  account: {
    minecraftUuid: string;
    minecraftUsername: string;
    accessToken: string;
  }
): Promise<void> {
  const launcher = new Client();
  const rootPath = path.join(os.homedir(), "AppData", "Roaming", ".paranoia-client");

  // Keep track of it
  activeLaunchers.set(profileId, launcher);
  
  const updateStatus = (status: LaunchStatus) => {
    launchStatuses.set(profileId, status);
  };

  try {
    const profile = exportProfile(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    const manifest = getManifest(profile.minecraftVersion, profile.profileTypeId, profile.graphicsModeId);
    if (!manifest) {
      throw new Error(`Manifest not found for ${profile.minecraftVersion} / ${profile.profileTypeId} / ${profile.graphicsModeId}`);
    }

    // 1. Verifier et telecharger Java 21
    updateStatus({ state: "downloading_java", progress: 0, text: "Verification de Java 21..." });
    const javaPath = await ensureJava21(rootPath, (text: string, percentage: number) => {
      updateStatus({ state: "downloading_java", progress: percentage, text });
    });

    // 2. Installer Fabric si nécessaire
    let customVersionName: string | undefined;
    if (manifest.fabricLoaderVersion) {
      customVersionName = await ensureFabric(rootPath, manifest.minecraftVersion, manifest.fabricLoaderVersion, (text, percentage) => {
        updateStatus({ state: "downloading_assets", progress: percentage, text });
      });
    }

    // 3. Telecharger les artefacts du manifeste
    if (manifest.artifacts.length > 0) {
      await downloadArtifacts(rootPath, manifest.artifacts, (text, percentage) => {
        updateStatus({ state: "downloading_assets", progress: percentage, text });
      });
    }

    // 4. Copier options.txt depuis le .minecraft vanilla si manquant
    const fs = await import("node:fs");
    const vanillaOptionsPath = path.join(os.homedir(), "AppData", "Roaming", ".minecraft", "options.txt");
    const targetOptionsPath = path.join(rootPath, "options.txt");
    
    if (fs.existsSync(vanillaOptionsPath) && !fs.existsSync(targetOptionsPath)) {
      try {
        fs.copyFileSync(vanillaOptionsPath, targetOptionsPath);
        console.log("Copied options.txt from vanilla .minecraft");
      } catch (e) {
        console.warn("Could not copy options.txt", e);
      }
    }

    // 4. Lancer Minecraft
    updateStatus({ state: "downloading_assets", progress: 0, text: "Preparation du lancement..." });

    const opts: any = {
      clientPackage: null as any,
      authorization: {
        access_token: account.accessToken,
        client_token: "paranoia-client",
        uuid: account.minecraftUuid,
        name: account.minecraftUsername,
        user_properties: {} as Partial<any>,
        meta: {
          type: "msa"
        }
      },
      root: rootPath,
      version: {
        number: minecraftVersion,
        type: "release"
      },
      memory: {
        max: `${ramMb}M`,
        min: `${Math.floor(ramMb / 2)}M`
      },
      javaPath: javaPath,
      overrides: {
        maxSockets: 6 // 6 est un bon compromis pour eviter les timeouts et les crashs EMFILE
      }
    };

    if (customVersionName) {
      opts.version.custom = customVersionName;
    }

    launcher.on('debug', (e) => console.log(`[MC Launcher Debug] ${e}`));
    launcher.on('data', (e) => console.log(`[MC Launcher Data] ${e}`));
    
    launcher.on('progress', (e) => {
      console.log(`[MC Launcher Progress] ${e.type} - ${e.task} : ${e.total}`);
      const progress = e.total > 0 ? Math.round((e.task / e.total) * 100) : 0;
      updateStatus({ 
        state: "downloading_assets", 
        progress, 
        text: `Telechargement des ressources (${e.type})...` 
      });
    });

    launcher.on('close', (e) => {
      console.log(`[MC Launcher Close] Exited with code ${e}`);
      activeLaunchers.delete(profileId);
      updateStatus({ state: "idle", progress: 0, text: "" });
    });

    console.log(`Starting Minecraft ${minecraftVersion} for ${account.minecraftUsername} at ${rootPath} with Java ${javaPath}`);
    
    // Une fois lance, on passe a "launching" (jeu en cours de demarrage)
    const proc = await launcher.launch(opts);
    if (proc) {
      updateStatus({ state: "running", progress: 100, text: "Jeu en cours d'execution" });
    }
    
  } catch (err) {
    console.error(`[MC Launcher Error]`, err);
    activeLaunchers.delete(profileId);
    updateStatus({ state: "error", progress: 0, text: err instanceof Error ? err.message : "Erreur fatale" });
    throw err;
  }
}

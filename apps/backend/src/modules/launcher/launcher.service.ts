import { Client } from "minecraft-launcher-core";
import path from "node:path";
import os from "node:os";
import { ensureJava21 } from "./javaDownloader";

export type LaunchStatus = {
  state: "idle" | "downloading_java" | "downloading_assets" | "launching" | "running" | "error";
  progress: number; // 0 to 100
  text: string;
};

/*
 * SERVICE DE LANCEMENT MINECRAFT
 * Ce service orchestre le demarrage d'une instance Minecraft via 'minecraft-launcher-core'.
 *
 * Fonctionnalites :
 * - Telechargement et configuration de Java 21 via le module javaDownloader
 * - Preparation des arguments de lancement (RAM, Auth, Versions)
 * - Lancement du processus de jeu et ecoute des evenements (telechargement de ressources, execution)
 * - Suivi en temps reel de la progression pour l'interface utilisateur
 */
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

  activeLaunchers.set(profileId, launcher);
  
  const updateStatus = (status: LaunchStatus) => {
    launchStatuses.set(profileId, status);
  };

  try {
    updateStatus({ state: "downloading_java", progress: 0, text: "Verification de Java 21..." });
    const javaPath = await ensureJava21(rootPath, (text, percentage) => {
      updateStatus({ state: "downloading_java", progress: percentage, text });
    });

    updateStatus({ state: "downloading_assets", progress: 0, text: "Preparation du lancement..." });

    const opts = {
      clientPackage: null,
      authorization: {
        access_token: account.accessToken,
        client_token: "paranoia-client",
        uuid: account.minecraftUuid,
        name: account.minecraftUsername,
        user_properties: "{}",
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
        maxSockets: 6
      }
    };

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

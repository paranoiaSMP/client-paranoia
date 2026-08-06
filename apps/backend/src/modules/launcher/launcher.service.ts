import { Client } from "minecraft-launcher-core";
import path from "node:path";
import { ensureJava21 } from "./javaDownloader.js";
import { getManifest } from "../catalog/catalog.routes.js";
import { exportProfile } from "../profiles/profiles.store.js";
import { ensureFabric } from "./fabricDownloader.js";
import { latestStableLoader } from "./fabricVersions.js";
import { downloadArtifacts } from "./artifactDownloader.js";
import { instanceDir, paranoiaDataDir, vanillaMinecraftDir } from "./paths.js";

export type LaunchStatus = {
  state: "idle" | "downloading_java" | "downloading_assets" | "launching" | "running" | "error";
  progress: number; // 0 to 100
  text: string;
};

// We store instances and status of launchers
const activeLaunchers = new Map<string, Client>();
const launchStatuses = new Map<string, LaunchStatus>();

/** "1920x1080" -> { width: 1920, height: 1080 }; null si la valeur est invalide. */
function parseResolution(
  resolution: string,
): { width: number; height: number } | null {
  const match = /^(\d{3,5})\s*[x×]\s*(\d{3,5})$/i.exec(resolution.trim());
  if (!match) {
    return null;
  }

  return { width: Number(match[1]), height: Number(match[2]) };
}

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
  // rootPath: partage entre tous les profils (versions, librairies, assets,
  // runtime Java). gameDir: propre au profil (mods, saves, config, options).
  // Sans cette separation, changer de profil ne changeait que la version et la
  // RAM: tous partageaient les memes mods et les memes mondes.
  const rootPath = paranoiaDataDir();
  const gameDir = instanceDir(profileId);

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

    // Toujours defini: une combinaison absente du catalogue donne un manifeste
    // vide, donc un lancement en vanilla plutot qu'un echec.
    const manifest = getManifest(profile.minecraftVersion, profile.profileTypeId, profile.graphicsModeId);

    // 1. Verifier et telecharger Java 21
    updateStatus({ state: "downloading_java", progress: 0, text: "Verification de Java 21..." });
    const java = await ensureJava21(rootPath, (text: string, percentage: number) => {
      updateStatus({ state: "downloading_java", progress: percentage, text });
    });

    // 2. Installer Fabric
    // Le manifeste peut epingler un loader precis; sinon on prend le dernier
    // stable publie pour cette version de Minecraft. Sans ca, aucune entree du
    // catalogue n'en declarant, Fabric n'etait jamais installe et les mods
    // deposes dans le dossier du profil etaient ignores par un jeu vanilla.
    let customVersionName: string | undefined;
    let loaderVersion = manifest.fabricLoaderVersion;

    if (!loaderVersion) {
      updateStatus({ state: "downloading_assets", progress: 0, text: "Recherche du loader Fabric..." });
      try {
        loaderVersion = (await latestStableLoader(manifest.minecraftVersion)) ?? undefined;
      } catch (err) {
        console.warn("[Launcher] loader Fabric introuvable:", err);
      }
    }

    if (loaderVersion) {
      // On passe le Java qu'on vient d'installer: l'installateur s'appuyait sur
      // un `java` present dans le PATH, ce qui echouait sur une machine sans JDK.
      customVersionName = await ensureFabric(rootPath, manifest.minecraftVersion, loaderVersion, java.java, (text, percentage) => {
        updateStatus({ state: "downloading_assets", progress: percentage, text });
      });
    } else {
      // Fabric ne supporte pas encore cette version: on lance en vanilla plutot
      // que d'echouer, mais les mods ne seront pas charges.
      console.warn(
        `[Launcher] aucun loader Fabric pour ${manifest.minecraftVersion}, lancement en vanilla`,
      );
    }

    // 3. Telecharger les artefacts du manifeste dans le dossier du profil
    const fs = await import("node:fs");
    await fs.promises.mkdir(gameDir, { recursive: true });

    if (manifest.artifacts.length > 0) {
      await downloadArtifacts(gameDir, manifest.artifacts, (text, percentage) => {
        updateStatus({ state: "downloading_assets", progress: percentage, text });
      });
    }

    const targetOptionsPath = path.join(gameDir, "options.txt");
    // LEOO955  


    // SYSTEM POUR COPIER LE OPTION.TXT D'UN PROFILE SELECTIONé
    const customOptionsPath = (profile as any).optionsTxtPath; 

    if (customOptionsPath && fs.existsSync(customOptionsPath)) {
      try {
        fs.copyFileSync(customOptionsPath, targetOptionsPath);
        console.log(`Copied custom options.txt from ${customOptionsPath}`);
      } catch (e) {
        console.warn("Could not copy custom options.txt", e);
      }
    } else {
      const vanillaOptionsPath = path.join(vanillaMinecraftDir(), "options.txt");
      if (fs.existsSync(vanillaOptionsPath) && !fs.existsSync(targetOptionsPath)) {
        try {
          fs.copyFileSync(vanillaOptionsPath, targetOptionsPath);
          console.log("Copied options.txt from vanilla .minecraft");
        } catch (e) {
          console.warn("Could not copy vanilla options.txt", e);
        }
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
      javaPath: java.javaw,
      overrides: {
        maxSockets: 6, // 6 est un bon compromis pour eviter les timeouts et les crashs EMFILE
        // Le jeu ecrit ses mondes, mods, configs et captures ici; les
        // telechargements lourds restent mutualises dans rootPath.
        gameDirectory: gameDir
      }
    };

    // La resolution etait enregistree dans le profil mais n'arrivait jamais
    // jusqu'au jeu: choisir 1280x720 n'avait donc aucun effet.
    const resolution = parseResolution(profile.resolution);
    if (resolution) {
      opts.window = resolution;
    }

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

    console.log(`Starting Minecraft ${minecraftVersion} for ${account.minecraftUsername} at ${rootPath} with Java ${java.javaw}`);
    
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

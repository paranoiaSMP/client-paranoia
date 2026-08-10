import { Client } from "minecraft-launcher-core";
import path from "node:path";
import { ensureJava } from "./javaDownloader.js";
import { requiredJavaMajor } from "./javaRequirement.js";
import { readSettings } from "../settings/settings.store.js";
import { setIdlePresence, setPlayingPresence } from '../discord/discord.service.js';
import { getManifest } from "../catalog/catalog.routes.js";
import { exportProfile } from "../profiles/profiles.store.js";
import { ensureFabric } from "./fabricDownloader.js";
import { latestStableLoader } from "./fabricVersions.js";
import { downloadArtifacts } from "./artifactDownloader.js";
import { ensureClientMod } from "./clientMod.js";
import { ensureFabricApi } from "./fabricApi.js";
import { instanceDir, paranoiaDataDir, vanillaMinecraftDir } from "./paths.js";

export type LaunchStatus = {
  state: "idle" | "downloading_java" | "downloading_assets" | "launching" | "running" | "error";
  progress: number; // 0 to 100
  text: string;
};

// We store instances and status of launchers
const activeLaunchers = new Map<string, Client>();
const activeProcesses = new Map<string, any>(); // Store the ChildProcess
const cancelFlags = new Map<string, boolean>();
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

export function cancelLaunch(profileId: string) {
  cancelFlags.set(profileId, true);
  const proc = activeProcesses.get(profileId);
  if (proc) {
    try {
      proc.kill();
    } catch (e) {
      console.warn("Could not kill process", e);
    }
  }
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
  cancelFlags.set(profileId, false);
  activeProcesses.delete(profileId);
  
  const updateStatus = (status: LaunchStatus) => {
    launchStatuses.set(profileId, status);
  };
  
  updateStatus({ state: "downloading_assets", progress: 0, text: "Initialisation du lancement..." });

  try {
    const profile = exportProfile(profileId);
    if (!profile) {
      throw new Error(`Profile ${profileId} not found`);
    }

    // Toujours defini: une combinaison absente du catalogue donne un manifeste
    // vide, donc un lancement en vanilla plutot qu'un echec.
    const manifest = getManifest(profile.minecraftVersion, profile.profileTypeId, profile.graphicsModeId);

    const settings = readSettings();

    // 1. Verifier et telecharger le Java attendu par cette version de Minecraft.
    // Le manifeste peut l'imposer; sinon Mojang le declare dans ses metadonnees.
    const javaMajor =
      manifest.requiredJavaMajor ||
      (await requiredJavaMajor(profile.minecraftVersion));

    updateStatus({ state: "downloading_java", progress: 0, text: `Verification de Java ${javaMajor}...` });
    const java = await ensureJava(javaMajor, rootPath, (text: string, percentage: number) => {
      updateStatus({ state: "downloading_java", progress: percentage, text });
    });
    
    if (cancelFlags.get(profileId)) throw new Error("Lancement annulé");

    // Un chemin Java saisi dans les parametres prime sur le runtime telecharge.
    const javaExecutable = settings.javaPath.trim() || java.javaw;

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
      if (cancelFlags.get(profileId)) throw new Error("Lancement annulé");
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
    
    if (cancelFlags.get(profileId)) throw new Error("Lancement annulé");

    // 4. Installer Fabric API, dont le client Paranoia depend, comme la
    // quasi-totalite des mods Fabric. Le launcher n'installait que le loader:
    // sans Fabric API, le loader refuse de charger le mod et le joueur voit un
    // jeu qui demarre sans que rien ne reponde.
    let fabricApiPath: string | null = null;
    if (loaderVersion) {
      try {
        fabricApiPath = await ensureFabricApi(gameDir, manifest.minecraftVersion, (text, percentage) => {
          updateStatus({ state: "downloading_assets", progress: percentage, text });
        });
      } catch (err) {
        console.warn("[Launcher] Fabric API non installe:", err);
      }
    }

    // 5. Installer le mod Paranoia, hors du dossier mods de l'instance: il est
    // charge par un argument JVM, donc le joueur ne peut ni le supprimer par
    // accident ni le confondre avec les mods qu'il installe lui-meme.
    const clientModPath = await ensureClientMod(rootPath, manifest.clientMod, (text, percentage) => {
      updateStatus({ state: "downloading_assets", progress: percentage, text });
    });

    if (clientModPath && !fabricApiPath) {
      throw new Error(
        "Fabric API n'a pas pu etre installe: le client Paranoia en depend et ne se chargerait pas. " +
        "Verifiez votre connexion, ou choisissez une version de Minecraft supportee.",
      );
    }

    console.log(
      `[Launcher] client Paranoia: ${clientModPath ?? "absent du catalogue pour cette version"}`,
    );

    // 6. options.txt
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


    // 7. Lancer Minecraft
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
        // La RAM du profil reste prioritaire; les parametres fournissent le
        // minimum et servent de valeur par defaut.
        max: `${ramMb || settings.ramMaxMb}M`,
        min: `${Math.min(settings.ramMinMb, ramMb || settings.ramMaxMb)}M`
      },
      javaPath: javaExecutable,
      overrides: {
        maxSockets: 6, // 6 est un bon compromis pour eviter les timeouts et les crashs EMFILE
        // Le jeu ecrit ses mondes, mods, configs et captures ici; les
        // telechargements lourds restent mutualises dans rootPath.
        gameDirectory: gameDir
      }
    };

    // La resolution etait enregistree dans le profil mais n'arrivait jamais
    // jusqu'au jeu: choisir 1280x720 n'avait donc aucun effet.
    const resolution = parseResolution(profile.resolution) ?? {
      width: settings.width,
      height: settings.height,
    };
    opts.window = settings.fullscreen
      ? { ...resolution, fullscreen: true }
      : resolution;

    // Arguments JVM saisis dans les parametres, ajoutes a ceux du launcher.
    const extraJvmArgs = settings.jvmArgs
      .split(/\s+/)
      .map((arg) => arg.trim())
      .filter((arg) => arg.length > 0);

    if (clientModPath) {
      // Ajoute comme element distinct du tableau, surtout pas via le decoupage
      // sur les espaces ci-dessus: un chemin Windows du type
      // C:\Users\Prenom Nom\AppData\... serait coupe en deux arguments.
      extraJvmArgs.push(`-Dfabric.addMods=${clientModPath}`);
    }

    if (extraJvmArgs.length > 0) {
      opts.customArgs = extraJvmArgs;
    }

    if (customVersionName) {
      opts.version.custom = customVersionName;
    }

    // Filtre les logs de debug pour cacher l'énorme commande Java illisible
    launcher.on('debug', (e) => {
      const msg = String(e);
      if (msg.includes("-cp") && msg.includes("mx4096M")) {
        console.log(`[🎮 Minecraft] Lancement du jeu en cours (arguments masqués pour la lisibilité)...`);
        return;
      }
      if (msg.includes("Arguments:")) return; // Cache la liste brute
      
      console.log(`[🔍 Debug] ${msg}`);
    });

    // Formate joliment les retours de la console du jeu
    launcher.on('data', (e) => {
      const msg = String(e).trim();
      if (!msg) return;
      console.log(`[📝 Log Jeu] ${msg}`);
    });
    
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
      activeProcesses.delete(profileId);
      updateStatus({ state: "idle", progress: 0, text: "" });
      setIdlePresence();
    });

    console.log(`Starting Minecraft ${minecraftVersion} for ${account.minecraftUsername} at ${rootPath} with Java ${javaMajor} (${javaExecutable})`);
    
    // Une fois lance, on passe a "launching" (jeu en cours de demarrage)
    const proc = await launcher.launch(opts);
    
    if (cancelFlags.get(profileId)) {
      if (proc) proc.kill();
      throw new Error("Lancement annulé");
    }
    
    if (proc) {
      activeProcesses.set(profileId, proc);
      updateStatus({ state: "running", progress: 100, text: "Jeu en cours d'execution" });
      setPlayingPresence(minecraftVersion, account.minecraftUsername);
    }
    
  } catch (err) {
    console.error(`[MC Launcher Error]`, err);
    activeLaunchers.delete(profileId);
    activeProcesses.delete(profileId);
    updateStatus({ state: "error", progress: 0, text: err instanceof Error ? err.message : "Erreur fatale" });
    throw err;
  }
}

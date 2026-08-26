import { Client } from "minecraft-launcher-core";
import fs from "node:fs";
import path from "node:path";
import { ensureJava } from "./javaDownloader.js";
import { requiredJavaMajor } from "./javaRequirement.js";
import { readSettings } from "../settings/settings.store.js";
import {
	setIdlePresence,
	setPlayingPresence,
} from "../discord/discord.service.js";
import { getManifest } from "../catalog/catalog.routes.js";
import { exportProfile } from "../profiles/profiles.store.js";
import { ensureFabric } from "./fabricDownloader.js";
import { latestStableLoader } from "./fabricVersions.js";
import { downloadArtifacts } from "./artifactDownloader.js";
import { ensureClientMod } from "./clientMod.js";
import { ensureFabricApi, findInstalledFabricApi } from "./fabricApi.js";
import { instanceDir, paranoiaDataDir, vanillaMinecraftDir } from "./paths.js";
import { env } from "../../config/env.js";

export type LaunchStatus = {
	state:
		| "idle"
		| "downloading_java"
		| "downloading_assets"
		| "launching"
		| "running"
		| "error";
	progress: number; // 0 to 100
	text: string;
};

// We store instances and status of launchers
const activeLaunchers = new Map<string, Client>();
const activeProcesses = new Map<string, any>(); // Store the ChildProcess
const cancelFlags = new Map<string, boolean>();
const launchStatuses = new Map<string, LaunchStatus>();

// Log buffer for the game and launcher events
const maxLogLines = 1000;
let gameLogs: string[] = [];

export function getGameLogs(): string[] {
	return gameLogs;
}

export function clearGameLogs(): void {
	gameLogs = [];
}

function addLog(msg: string) {
	const timestamp = new Date().toLocaleTimeString();
	gameLogs.push(`[${timestamp}] ${msg}`);
	if (gameLogs.length > maxLogLines) {
		gameLogs = gameLogs.slice(gameLogs.length - maxLogLines);
	}
}

/**
 * Impose le mode fenetre ou plein ecran dans options.txt.
 *
 * <p>C'est ce fichier qui decide, pas la ligne de commande: l'argument
 * `--fullscreen` ne sait que forcer le plein ecran, jamais l'inverse. Un
 * options.txt recupere du launcher officiel -- ou laisse par un appui sur F11
 * en jeu -- portant `fullscreen:true` rendait donc le mode fenetre
 * inatteignable, quel que soit le reglage du launcher.
 */
function applyWindowMode(optionsPath: string, fullscreen: boolean): void {
	try {
		const line = `fullscreen:${fullscreen}`;
		let content = "";

		if (fs.existsSync(optionsPath)) {
			content = fs.readFileSync(optionsPath, "utf8");
		}

		// \r? indispensable: un options.txt venu de Windows est en CRLF.
		const pattern = /^fullscreen:.*$/m;
		content = pattern.test(content)
			? content.replace(pattern, line)
			: (content.length > 0 && !content.endsWith("\n")
					? content + "\n"
					: content) +
				line +
				"\n";

		fs.writeFileSync(optionsPath, content);
	} catch (err) {
		// Un options.txt illisible ne doit pas empecher de jouer.
		console.warn("[Launcher] mode d'affichage non applique:", err);
	}
}

/**
 * Journal du launcher, ecrit a cote des donnees du jeu.
 *
 * <p>La console du sidecar n'est visible nulle part chez le joueur. Quand le mod
 * Paranoia n'etait pas charge, le jeu demarrait normalement, le mod manquait a
 * l'appel et rien n'expliquait pourquoi -- il a fallu quatre allers-retours de
 * journaux de jeu pour le comprendre. La reponse doit etre quelque part.
 */
function logToFile(rootPath: string, message: string): void {
	const file = path.join(rootPath, "launcher.log");

	try {
		// Borne volontairement basse: c'est un journal de diagnostic, pas un
		// historique. Au-dela, on repart d'un fichier vide.
		if (
			(fs.statSync(file, { throwIfNoEntry: false })?.size ?? 0) >
			512 * 1024
		) {
			fs.rmSync(file, { force: true });
		}
		fs.appendFileSync(file, `[${new Date().toISOString()}] ${message}\n`);
	} catch {
		// Un journal qui echoue ne doit jamais empecher un lancement.
	}
}

export function getLaunchStatus(profileId: string): LaunchStatus {
	return (
		launchStatuses.get(profileId) || { state: "idle", progress: 0, text: "" }
	);
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
	},
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
		addLog(`[Launcher] [${status.state.toUpperCase()}] ${status.text}`);
	};

	updateStatus({
		state: "downloading_assets",
		progress: 0,
		text: "Initialisation du lancement...",
	});

	try {
		const profile = exportProfile(profileId);
		if (!profile) {
			throw new Error(`Profile ${profileId} not found`);
		}

		if (env.BAN_API_URL) {
			updateStatus({
				state: "downloading_assets",
				progress: 0,
				text: "Vérification de l'état du compte...",
			});
			try {
				// Le site doit renvoyer du JSON. S'il renvoie { banned: true, reason: "..." } on bloque.
				const banUrl = new URL(env.BAN_API_URL);
				banUrl.searchParams.set("uuid", account.minecraftUuid);

				const banRes = await fetch(banUrl.toString());
				if (banRes.ok) {
					const banData = await banRes.json().catch(() => ({}));
					if (banData.banned) {
						throw new Error(
							`Vous êtes banni. Raison: ${banData.reason || "Non spécifiée"}`,
						);
					}
				}
			} catch (err: any) {
				if (err.message && err.message.startsWith("Vous êtes banni")) {
					throw err; // On relance l'erreur de ban pour bloquer le lancement
				}
				console.warn(
					"[Launcher] Impossible de joindre l'API de ban, on autorise le lancement par précaution:",
					err,
				);
			}
		}

		// Toujours defini: une combinaison absente du catalogue donne un manifeste
		// vide, donc un lancement en vanilla plutot qu'un echec.
		const manifest = getManifest(
			profile.minecraftVersion,
			profile.profileTypeId,
			profile.graphicsModeId,
		);

		const settings = readSettings();

		// 1. Verifier et telecharger le Java attendu par cette version de Minecraft.
		// Le manifeste peut l'imposer; sinon Mojang le declare dans ses metadonnees.
		const javaMajor =
			manifest.requiredJavaMajor ||
			(await requiredJavaMajor(profile.minecraftVersion));

		updateStatus({
			state: "downloading_java",
			progress: 0,
			text: `Verification de Java ${javaMajor}...`,
		});
		const java = await ensureJava(
			javaMajor,
			rootPath,
			(text: string, percentage: number) => {
				updateStatus({ state: "downloading_java", progress: percentage, text });
			},
		);

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
			updateStatus({
				state: "downloading_assets",
				progress: 0,
				text: "Recherche du loader Fabric...",
			});
			try {
				loaderVersion =
					(await latestStableLoader(manifest.minecraftVersion)) ?? undefined;
			} catch (err) {
				console.warn("[Launcher] loader Fabric introuvable:", err);
			}
		}

		if (loaderVersion) {
			// On passe le Java qu'on vient d'installer: l'installateur s'appuyait sur
			// un `java` present dans le PATH, ce qui echouait sur une machine sans JDK.
			customVersionName = await ensureFabric(
				rootPath,
				manifest.minecraftVersion,
				loaderVersion,
				java.java,
				(text, percentage) => {
					updateStatus({
						state: "downloading_assets",
						progress: percentage,
						text,
					});
				},
			);
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
			await downloadArtifacts(
				gameDir,
				manifest.artifacts,
				(text, percentage) => {
					updateStatus({
						state: "downloading_assets",
						progress: percentage,
						text,
					});
				},
			);
		}

		if (cancelFlags.get(profileId)) throw new Error("Lancement annulé");

		// 4. Installer Fabric API, dont le client Paranoia depend, comme la
		// quasi-totalite des mods Fabric. Le launcher n'installait que le loader:
		// sans Fabric API, le loader refuse de charger le mod et le joueur voit un
		// jeu qui demarre sans que rien ne reponde.
		let fabricApiPath: string | null = null;
		if (loaderVersion) {
			try {
				fabricApiPath = await ensureFabricApi(
					gameDir,
					manifest.minecraftVersion,
					(text, percentage) => {
						updateStatus({
							state: "downloading_assets",
							progress: percentage,
							text,
						});
					},
				);
			} catch (err) {
				console.warn("[Launcher] Fabric API non installe:", err);
			}

			// Une panne de Modrinth ne doit pas faire passer pour absent un Fabric API
			// deja pose dans l'instance: c'est le disque qui fait foi. Sans ce
			// rattrapage, une recherche ratee suffisait a ce que le mod Paranoia ne
			// soit pas charge -- jeu qui demarre normalement, mod absent de la liste,
			// aucune erreur nulle part.
			if (!fabricApiPath) {
				fabricApiPath = findInstalledFabricApi(gameDir);
			}
		}

		// 5. Installer le mod Paranoia, hors du dossier mods de l'instance: il est
		// charge par un argument JVM, donc le joueur ne peut ni le supprimer par
		// accident ni le confondre avec les mods qu'il installe lui-meme.
		//
		// Rien de ce qui suit ne doit empecher le jeu de demarrer. Le mod est un
		// plus; Minecraft est ce que le joueur est venu lancer. Une panne de
		// Modrinth ou de GitHub ne doit pas se traduire par "impossible de jouer".
		let clientModPath: string | null = null;
		let clientModError: string | null = null;

		try {
			clientModPath = await ensureClientMod(
				rootPath,
				manifest.clientMod,
				(text, percentage) => {
					updateStatus({
						state: "downloading_assets",
						progress: percentage,
						text,
					});
				},
			);
		} catch (err) {
			clientModError = err instanceof Error ? err.message : String(err);
			console.warn("[Launcher] client Paranoia non installe:", err);
		}

		// Sans Fabric API le loader refuserait de charger le mod et afficherait un
		// ecran d'erreur a la place du jeu: on prefere lancer sans le mod.
		if (clientModPath && !fabricApiPath) {
			console.warn(
				"[Launcher] Fabric API absent: le client Paranoia ne sera pas charge",
			);
			clientModPath = null;
		}

		const modState = clientModPath
			? `charge (${path.basename(clientModPath)})`
			: "non charge (" +
				`Fabric API ${fabricApiPath ? "present" : "absent"}, ` +
				`catalogue ${
					manifest.clientMod
						? `fournit ${manifest.clientMod.fileName}`
						: "sans jar pour cette version"
				}` +
				`${clientModError ? `, echec: ${clientModError}` : ""})`;

		// Le type de profil et le mode graphique figurent dans la ligne: c'est le
		// couple qui sert a retrouver l'entree du catalogue, et son absence du
		// journal a coute un aller-retour de diagnostic complet.
		console.log(`[Launcher] client Paranoia ${modState}`);
		addLog(`[Launcher] client Paranoia ${modState}`);
		logToFile(
			rootPath,
			`Minecraft ${manifest.minecraftVersion} (${profile.profileTypeId}/${profile.graphicsModeId}): ` +
				`client Paranoia ${modState}`,
		);

		// 6. options.txt
		const targetOptionsPath = path.join(gameDir, "options.txt");
		// LEOO955

		// SYSTEM POUR COPIER LE OPTION.TXT D'UN PROFILE SELECTIONé
		const customOptionsPath = (profile as any).optionsTxtPath;

		if (!fs.existsSync(targetOptionsPath)) {
			if (customOptionsPath && fs.existsSync(customOptionsPath)) {
				try {
					fs.copyFileSync(customOptionsPath, targetOptionsPath);
					console.log(`Copied custom options.txt from ${customOptionsPath}`);
					addLog(`[Launcher] Copie de options.txt personnalisé depuis : ${customOptionsPath}`);
				} catch (e) {
					console.warn("Could not copy custom options.txt", e);
					addLog(`[Launcher] Impossible de copier options.txt personnalisé : ${e instanceof Error ? e.message : String(e)}`);
				}
			} else {
				const vanillaOptionsPath = path.join(
					vanillaMinecraftDir(),
					"options.txt",
				);
				if (fs.existsSync(vanillaOptionsPath)) {
					try {
						fs.copyFileSync(vanillaOptionsPath, targetOptionsPath);
						console.log("Copied options.txt from vanilla .minecraft");
						addLog("[Launcher] Copie de options.txt depuis Minecraft vanilla");
					} catch (e) {
						console.warn("Could not copy vanilla options.txt", e);
						addLog(`[Launcher] Impossible de copier options.txt vanilla : ${e instanceof Error ? e.message : String(e)}`);
					}
				}
			}
		}

		// Le mode d'affichage est ecrit apres la copie: sinon la valeur du fichier
		// source ecraserait le choix du joueur.
		applyWindowMode(targetOptionsPath, settings.fullscreen);

		// 7. Lancer Minecraft
		updateStatus({
			state: "downloading_assets",
			progress: 0,
			text: "Preparation du lancement...",
		});

		const opts: any = {
			clientPackage: null as any,
			authorization: {
				access_token: account.accessToken,
				client_token: "paranoia-client",
				uuid: account.minecraftUuid,
				name: account.minecraftUsername,
				user_properties: {} as Partial<any>,
				meta: {
					type: "msa",
				},
			},
			root: rootPath,
			version: {
				number: minecraftVersion,
				type: "release",
			},
			memory: {
				// La RAM du profil reste prioritaire; les parametres fournissent le
				// minimum et servent de valeur par defaut.
				max: `${ramMb || settings.ramMaxMb}M`,
				min: `${Math.min(settings.ramMinMb, ramMb || settings.ramMaxMb)}M`,
			},
			javaPath: javaExecutable,
			overrides: {
				maxSockets: 6, // 6 est un bon compromis pour eviter les timeouts et les crashs EMFILE
				// Le jeu ecrit ses mondes, mods, configs et captures ici; les
				// telechargements lourds restent mutualises dans rootPath.
				gameDirectory: gameDir,
			},
		};

		// La resolution etait enregistree dans le profil mais n'arrivait jamais
		// jusqu'au jeu: choisir 1280x720 n'avait donc aucun effet.
		// La taille des parametres prime sur celle du profil.
		//
		// Le champ du profil n'a jamais eu de controle dans l'interface: il valait
		// "1920x1080" pour tout le monde, ecrasait le reglage visible, et donnait
		// une fenetre de la taille exacte de l'ecran -- qu'on prend pour du plein
		// ecran, et ou F11 bascule entre deux etats identiques a l'oeil.
		const resolution = {
			width: settings.width,
			height: settings.height,
		};
		// En fenetre, la taille vient du profil; en plein ecran elle est ignoree
		// par le jeu, mais reste utile au retour en fenetre.
		opts.window = settings.fullscreen
			? { ...resolution, fullscreen: true }
			: { ...resolution, fullscreen: false };

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
		launcher.on("debug", (e) => {
			const msg = String(e);
			if (msg.includes("-cp") && msg.includes("mx4096M")) {
				const logMsg = "[🎮 Minecraft] Lancement du jeu en cours (arguments masqués pour la lisibilité)...";
				console.log(logMsg);
				addLog(logMsg);
				return;
			}
			if (msg.includes("Arguments:")) return; // Cache la liste brute

			console.log(`[🔍 Debug] ${msg}`);
			addLog(`[🔍 Debug] ${msg}`);
		});

		// Formate joliment les retours de la console du jeu
		launcher.on("data", (e) => {
			const msg = String(e).trim();
			if (!msg) return;
			console.log(`[📝 Log Jeu] ${msg}`);
			const lines = msg.split(/\r?\n/);
			for (const line of lines) {
				addLog(`[📝 Log Jeu] ${line}`);
			}
		});

		launcher.on("progress", (e) => {
			console.log(`[MC Launcher Progress] ${e.type} - ${e.task} : ${e.total}`);
			const progress = e.total > 0 ? Math.round((e.task / e.total) * 100) : 0;
			updateStatus({
				state: "downloading_assets",
				progress,
				text: `Telechargement des ressources (${e.type})...`,
			});
		});

		launcher.on("close", (e) => {
			console.log(`[MC Launcher Close] Exited with code ${e}`);
			activeLaunchers.delete(profileId);
			activeProcesses.delete(profileId);
			updateStatus({ state: "idle", progress: 0, text: "" });
			setIdlePresence();
			addLog(`[Launcher] Jeu fermé avec le code de sortie ${e}`);
		});

		const startMsg = `Starting Minecraft ${minecraftVersion} for ${account.minecraftUsername} at ${rootPath} with Java ${javaMajor} (${javaExecutable})`;
		console.log(startMsg);
		addLog(`[Launcher] ${startMsg}`);

		// Une fois lance, on passe a "launching" (jeu en cours de demarrage)
		const proc = await launcher.launch(opts);

		if (cancelFlags.get(profileId)) {
			if (proc) proc.kill();
			throw new Error("Lancement annulé");
		}

		if (proc) {
			activeProcesses.set(profileId, proc);

			// DEV/OPTI: Forcer la priorite "Haute" sur le processus pour un maximum de FPS
			try {
				const os = await import("node:os");
				if (proc.pid) {
					os.setPriority(proc.pid, os.constants.priority.PRIORITY_HIGH);
					const priorityMsg = `[Launcher] Opti: Process ${proc.pid} boosted to HIGH priority for maximum FPS.`;
					console.log(priorityMsg);
					addLog(priorityMsg);
				}
			} catch (priErr) {
				console.warn(
					"[Launcher] Impossible d'appliquer la priorite haute:",
					priErr,
				);
				addLog(`[Launcher] Impossible d'appliquer la priorité haute: ${String(priErr)}`);
			}

			updateStatus({
				state: "running",
				progress: 100,
				text: "Jeu en cours d'execution",
			});
			setPlayingPresence(minecraftVersion, account.minecraftUsername);
		}
	} catch (err) {
		console.error(`[MC Launcher Error]`, err);
		activeLaunchers.delete(profileId);
		activeProcesses.delete(profileId);
		updateStatus({
			state: "error",
			progress: 0,
			text: err instanceof Error ? err.message : "Erreur fatale",
		});
		addLog(`[Launcher] Erreur de lancement: ${err instanceof Error ? err.message : String(err)}`);
		throw err;
	}
}

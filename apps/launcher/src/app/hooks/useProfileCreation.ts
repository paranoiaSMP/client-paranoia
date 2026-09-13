import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { RemoteConfiguration } from "@paranoia/contracts";

import { createInstallationManifest } from "../../shared/api/catalogClient";
import { createProfile } from "../../shared/api/profilesClient";
import type {
	DetectedProfile,
	ImportOptions,
	SetupStep,
} from "../components/ProfileCreation";

type UseProfileCreationOptions = {
	config: RemoteConfiguration | null;
	refreshProfiles: () => Promise<unknown>;
	setError: (message: string | null) => void;
	/** Signale que l'installation a reussi, pour refermer l'assistant. */
	onInstalled: () => void;
	/** Message affiche quand l'echec n'est pas une Error. */
	fallbackError: string;
};

/**
 * L'assistant de creation d'instance, en un seul objet.
 *
 * <p>Ses dix etats vivaient a plat dans le composant racine, melanges a ceux
 * de l'authentification, du lancement et des ecrans ouverts. Regroupes ici,
 * ils cessent de peser sur un fichier qui n'en fait rien: personne d'autre que
 * l'assistant ne lit {@code keybindSource} ou {@code importOptions}.
 */
export function useProfileCreation({
	config,
	refreshProfiles,
	setError,
	onInstalled,
	fallbackError,
}: UseProfileCreationOptions) {
	const [step, setStep] = useState<SetupStep>(1);
	const [isCreating, setIsCreating] = useState(false);
	const [minecraftVersion, setMinecraftVersion] = useState("1.21.1");
	const [profileType, setProfileType] = useState("pvp");
	const [graphicsMode, setGraphicsMode] = useState("performance");
	const [profileName, setProfileName] = useState("Mon profil");
	const [importSettings, setImportSettings] = useState(false);
	const [keybindSource, setKeybindSource] = useState("auto");
	const [detectedProfiles, setDetectedProfiles] = useState<DetectedProfile[]>(
		[],
	);
	const [importOptions, setImportOptions] = useState<ImportOptions>({
		keybinds: true,
		sensitivity: true,
		graphics: false,
	});

	// Les valeurs par defaut viennent du catalogue des qu'il arrive. C'etait
	// jusqu'ici le demarrage qui allait les ecrire dans l'assistant, ce qui lui
	// donnait a connaitre trois etats qui ne le regardent pas.
	useEffect(() => {
		if (!config) return;
		const version = config.supportedMinecraftVersions[0];
		if (version) setMinecraftVersion(version);
		const type = config.profileTypes[0];
		if (type) setProfileType(type.id);
		const graphics = config.graphicsModes[0];
		if (graphics) setGraphicsMode(graphics.id);
	}, [config]);

	// Les profils des autres launchers ne sont cherches que si on a demande a
	// reprendre des reglages, et une seule fois.
	useEffect(() => {
		if (!importSettings || detectedProfiles.length > 0) return;
		invoke<DetectedProfile[]>("get_detected_profiles")
			.then(setDetectedProfiles)
			.catch((err: unknown) =>
				console.error("Erreur de detection des profils :", err),
			);
	}, [importSettings, detectedProfiles.length]);

	const selectedType = useMemo(
		() => config?.profileTypes.find((x) => x.id === profileType),
		[config, profileType],
	);
	const selectedGraphics = useMemo(
		() => config?.graphicsModes.find((x) => x.id === graphicsMode),
		[config, graphicsMode],
	);

	/** Le fichier options.txt a reprendre, selon la source choisie. */
	function optionsTxtPath(): string | undefined {
		if (keybindSource === "auto") {
			return detectedProfiles[0]?.options_path;
		}
		return detectedProfiles.find((p) => p.id === keybindSource)?.options_path;
	}

	async function install() {
		try {
			setError(null);
			await createInstallationManifest({
				minecraftVersion,
				profileTypeId: profileType,
				graphicsModeId: graphicsMode,
				locale: "fr-FR",
			});
			await createProfile({
				name: profileName,
				minecraftVersion,
				profileTypeId: profileType,
				graphicsModeId: graphicsMode,
				ramMb: 4096,
				optionsTxtPath: optionsTxtPath(),
			});
			await refreshProfiles();
			setIsCreating(false);
			setStep(1);
			onInstalled();
		} catch (e) {
			setError(e instanceof Error ? e.message : fallbackError);
		}
	}

	/** Rouvre l'assistant a son premier ecran utile. */
	function start(connected: boolean) {
		setStep(connected ? 2 : 1);
		setIsCreating(true);
	}

	return {
		step,
		setStep,
		isCreating,
		setIsCreating,
		start,
		minecraftVersion,
		setMinecraftVersion,
		profileType,
		setProfileType,
		graphicsMode,
		setGraphicsMode,
		profileName,
		setProfileName,
		importSettings,
		setImportSettings,
		keybindSource,
		setKeybindSource,
		detectedProfiles,
		importOptions,
		setImportOptions,
		selectedType,
		selectedGraphics,
		install,
	};
}

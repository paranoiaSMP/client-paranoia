import { useEffect, useState } from "react";
import type { LauncherProfile, MicrosoftAccount } from "@paranoia/contracts";

import {
	cancelLaunch,
	getLaunchStatus,
	launchMinecraftGame,
	type LaunchStatusResponse,
} from "../../shared/api/launcherClient";

/** Ce que l'accueil sait de l'etat du lancement. */
export type InstallState = "idle" | "running" | "done";

const IDLE: LaunchStatusResponse = { state: "idle", progress: 0, text: "" };

type UseLaunchOptions = {
	profile: LauncherProfile | null;
	account: MicrosoftAccount | null;
	setError: (message: string | null) => void;
};

/**
 * Le lancement du jeu, et ce que le backend en dit.
 *
 * <p>L'etat vit ici en double, et ce n'est pas une redondance: {@code status}
 * est ce que le backend rapporte, {@code installState} ce que l'interface
 * montre. Les deux divergent volontairement le temps d'un aller-retour --
 * cliquer sur Jouer passe l'interface en « lancement » immediatement, avant
 * que le backend n'ait rien a dire.
 *
 * <p>Le sondage tourne a la seconde tant qu'un profil est choisi. Il s'arrete
 * en changeant de profil, et l'intervalle precedent est coupe: sans cela,
 * passer d'une instance a l'autre en laissait un derriere soi a chaque fois.
 */
export function useLaunch({ profile, account, setError }: UseLaunchOptions) {
	const [installState, setInstallState] = useState<InstallState>("idle");
	const [status, setStatus] = useState<LaunchStatusResponse>(IDLE);

	const profileId = profile?.id;

	useEffect(() => {
		if (!profileId) return;

		let intervalId: ReturnType<typeof setInterval>;

		const checkStatus = async () => {
			try {
				const next = await getLaunchStatus(profileId);
				setStatus(next);

				setInstallState((prev) => {
					if (next.state === "error" && prev === "running") {
						setError(next.text);
						return "idle";
					}
					if (next.state === "idle" && prev === "running") {
						return "idle";
					}
					if (
						next.state !== "idle" &&
						next.state !== "error" &&
						prev === "idle"
					) {
						return "running";
					}
					return prev;
				});
			} catch (e) {
				console.error(e);
			}
		};

		// Une premiere fois tout de suite: attendre une seconde apres un
		// changement de profil laisserait l'ecran sur l'etat du precedent.
		void checkStatus();
		intervalId = setInterval(checkStatus, 1000);

		return () => clearInterval(intervalId);
	}, [profileId, setError]);

	async function launch(target: LauncherProfile) {
		if (!account) return;
		try {
			setInstallState("running");
			setStatus({ state: "idle", progress: 0, text: "Initialisation..." });
			await launchMinecraftGame(
				target.id,
				target.minecraftVersion,
				target.ramMb,
				account,
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Erreur au lancement du jeu");
			setInstallState("idle");
		}
	}

	async function cancel() {
		if (!profileId) return;
		try {
			await cancelLaunch(profileId);
			setInstallState("idle");
			setStatus(IDLE);
		} catch (e) {
			console.error(e);
		}
	}

	return { installState, setInstallState, status, launch, cancel };
}

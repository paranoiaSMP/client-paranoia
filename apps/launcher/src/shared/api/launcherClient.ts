import type { MicrosoftAccount } from "@paranoia/contracts";
import { apiRequest } from "./http";

export type LaunchStatusResponse = {
	state:
		| "idle"
		| "downloading_java"
		| "downloading_assets"
		| "launching"
		| "running"
		| "error";
	progress: number;
	text: string;
};

export async function launchMinecraftGame(
	profileId: string,
	minecraftVersion: string,
	ramMb: number,
	account: MicrosoftAccount,
): Promise<void> {
	await apiRequest<{ status: string }>("/v1/launcher/play", {
		method: "POST",
		body: JSON.stringify({
			profileId,
			minecraftVersion,
			ramMb,
			account: {
				// L'identifiant en plus du jeton: c'est lui qui permet au backend
				// d'aller chercher la session enregistree et de la renouveler si
				// elle a expire depuis le demarrage du launcher. Sans lui, un
				// launcher ouvert depuis la veille lance le jeu avec un jeton mort.
				id: account.id,
				minecraftUuid: account.minecraftUuid,
				minecraftUsername: account.minecraftUsername,
				accessToken: account.accessToken,
			},
		}),
	});
}

export async function getLaunchStatus(
	profileId: string,
): Promise<LaunchStatusResponse> {
	return apiRequest<LaunchStatusResponse>(
		`/v1/launcher/status/${encodeURIComponent(profileId)}`,
	);
}

export async function cancelLaunch(profileId: string): Promise<void> {
	await apiRequest<{ status: string }>(
		`/v1/launcher/cancel/${encodeURIComponent(profileId)}`,
		{ method: "POST" },
	);
}

export async function getGameLogs(): Promise<{ logs: string[] }> {
	return apiRequest<{ logs: string[] }>("/v1/launcher/logs");
}

export async function clearGameLogs(): Promise<{ status: string }> {
	return apiRequest<{ status: string }>("/v1/launcher/logs/clear", {
		method: "POST",
	});
}

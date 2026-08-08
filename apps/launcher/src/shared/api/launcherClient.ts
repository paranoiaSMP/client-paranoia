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
export async function stopMinecraftGame(profileId: string): Promise<void> {
  await apiRequest<{ success: boolean }>(
    `/v1/launcher/stop/${encodeURIComponent(profileId)}`,{
      method: "POST",
    });
    }

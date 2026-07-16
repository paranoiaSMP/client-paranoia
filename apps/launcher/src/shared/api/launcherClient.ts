import type { MicrosoftAccount } from "@paranoia/contracts";

const API_URL = "http://localhost:8080/v1";

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
  const response = await fetch(`${API_URL}/launcher/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      profileId,
      minecraftVersion,
      ramMb,
      account,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to launch game");
  }
}

export async function getLaunchStatus(
  profileId: string,
): Promise<LaunchStatusResponse> {
  const response = await fetch(`${API_URL}/launcher/status/${profileId}`);
  if (!response.ok) {
    throw new Error("Failed to get launch status");
  }
  return response.json();
}

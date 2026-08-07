import { apiRequest } from "./http";

export type LauncherSettings = {
  ramMinMb: number;
  ramMaxMb: number;
  javaPath: string;
  jvmArgs: string;
  width: number;
  height: number;
  fullscreen: boolean;
  keepLauncherOpen: boolean;
  autoConnect: boolean;
  language: "fr" | "en";
};

export async function fetchSettings(): Promise<LauncherSettings> {
  return apiRequest<LauncherSettings>("/v1/settings");
}

export async function saveSettings(
  settings: LauncherSettings,
): Promise<LauncherSettings> {
  return apiRequest<LauncherSettings>("/v1/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
}

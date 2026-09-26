import { apiRequest } from "./http";

export type BugReportPayload = {
  title: string;
  description: string;
  category?: string | undefined;
  accountName?: string | undefined;
  systemInfo?: {
    ramMaxMb?: number | null | undefined;
    launcherVersion?: string | undefined;
    minecraftVersion?: string | undefined;
    profileName?: string | undefined;
    profileType?: string | undefined;
    graphicsMode?: string | undefined;
    gpu?: string | undefined;
    screenResolution?: string | undefined;
  } | undefined;
  logs?: string | undefined;
};

export async function sendBugReport(
  payload: BugReportPayload,
): Promise<{ success: boolean; warning?: string }> {
  return apiRequest<{ success: boolean; warning?: string }>("/v1/reports/bug", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

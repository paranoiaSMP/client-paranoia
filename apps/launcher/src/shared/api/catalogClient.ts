import type { CreateManifestRequest, InstallationManifest, RemoteConfiguration } from "@paranoia/contracts";
import { apiRequest } from "./http";

export async function fetchRemoteConfiguration(): Promise<RemoteConfiguration> {
  return apiRequest<RemoteConfiguration>("/v1/catalog/remote-config");
}

export async function createInstallationManifest(
  input: CreateManifestRequest
): Promise<InstallationManifest> {
  return apiRequest<InstallationManifest>("/v1/catalog/manifest", {
    method: "POST",
    body: JSON.stringify(input)
  });
}

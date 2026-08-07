import { apiRequest } from "./http";

export type ModSearchHit = {
  projectId: string;
  slug: string;
  title: string;
  description: string;
  author: string;
  downloads: number;
  iconUrl: string | null;
  categories: string[];
};

export type ModVersion = {
  versionId: string;
  name: string;
  versionNumber: string;
  gameVersions: string[];
  loaders: string[];
  fileName: string;
  downloadUrl: string;
  size: number;
  sha512: string;
  datePublished: string;
};

export type InstalledMod = {
  fileName: string;
  size: number;
  installedAt: string;
};

export async function searchMods(opts: {
  query: string;
  gameVersion?: string;
  loader?: string;
  limit?: number;
}): Promise<{ hits: ModSearchHit[]; total: number }> {
  const params = new URLSearchParams({ query: opts.query });
  if (opts.gameVersion) params.set("gameVersion", opts.gameVersion);
  if (opts.loader) params.set("loader", opts.loader);
  if (opts.limit) params.set("limit", String(opts.limit));

  return apiRequest(`/v1/mods/search?${params.toString()}`);
}

export async function listProjectVersions(
  projectId: string,
  opts: { gameVersion?: string; loader?: string } = {},
): Promise<ModVersion[]> {
  const params = new URLSearchParams();
  if (opts.gameVersion) params.set("gameVersion", opts.gameVersion);
  if (opts.loader) params.set("loader", opts.loader);

  return apiRequest(
    `/v1/mods/projects/${encodeURIComponent(projectId)}/versions?${params.toString()}`,
  );
}

export type InstallResult = {
  mod: InstalledMod;
  dependencies: InstalledMod[];
};

export async function installMod(input: {
  profileId: string;
  projectId: string;
  versionId: string;
  gameVersion?: string;
  loader?: string;
}): Promise<InstallResult> {
  return apiRequest("/v1/mods/install", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listInstalledMods(
  profileId: string,
): Promise<InstalledMod[]> {
  return apiRequest(`/v1/mods/installed/${encodeURIComponent(profileId)}`);
}

export async function removeMod(
  profileId: string,
  fileName: string,
): Promise<void> {
  await apiRequest<void>(
    `/v1/mods/installed/${encodeURIComponent(profileId)}/${encodeURIComponent(fileName)}`,
    { method: "DELETE" },
  );
}

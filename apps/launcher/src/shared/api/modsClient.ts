import { apiRequest } from "./http";

export type ContentType = "mod" | "shader" | "resourcepack";

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
  name?: string | null;
  iconUrl?: string | null;
  size: number;
  installedAt: string;
  enabled: boolean;
};

export async function searchMods(opts: {
  query: string;
  gameVersion?: string | undefined;
  loader?: string | undefined;
  projectType?: ContentType | undefined;
  limit?: number | undefined;
  offset?: number | undefined;
}): Promise<{ hits: ModSearchHit[]; total: number }> {
  const params = new URLSearchParams({ query: opts.query });
  if (opts.gameVersion) params.set("gameVersion", opts.gameVersion);
  if (opts.loader) params.set("loader", opts.loader);
  if (opts.projectType) params.set("projectType", opts.projectType);
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.offset) params.set("offset", String(opts.offset));

  return apiRequest(`/v1/mods/search?${params.toString()}`);
}

export async function listProjectVersions(
  projectId: string,
  opts: { gameVersion?: string | undefined; loader?: string | undefined } = {},
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
  gameVersion?: string | undefined;
  loader?: string | undefined;
  projectType?: ContentType | undefined;
}): Promise<InstallResult> {
  return apiRequest("/v1/mods/install", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function listInstalledMods(
  profileId: string,
  type: ContentType = "mod",
): Promise<InstalledMod[]> {
  return apiRequest(
    `/v1/mods/installed/${encodeURIComponent(profileId)}?type=${encodeURIComponent(type)}`,
  );
}

export async function toggleMod(
  profileId: string,
  fileName: string,
  type: ContentType = "mod",
): Promise<InstalledMod> {
  return apiRequest(
    `/v1/mods/installed/${encodeURIComponent(profileId)}/${encodeURIComponent(fileName)}/toggle`,
    {
      method: "POST",
      body: JSON.stringify({ type }),
    },
  );
}

export async function removeMod(
  profileId: string,
  fileName: string,
  type: ContentType = "mod",
): Promise<void> {
  await apiRequest<void>(
    `/v1/mods/installed/${encodeURIComponent(profileId)}/${encodeURIComponent(fileName)}?type=${encodeURIComponent(type)}`,
    { method: "DELETE" },
  );
}

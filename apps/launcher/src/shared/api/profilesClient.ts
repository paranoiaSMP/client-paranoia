import type {
  CreateLauncherProfileRequest,
  LauncherProfile,
} from "@paranoia/contracts";
import { apiRequest } from "./http";

export async function listProfiles(): Promise<LauncherProfile[]> {
  return apiRequest<LauncherProfile[]>("/v1/profiles");
}

export async function createProfile(
  input: CreateLauncherProfileRequest,
): Promise<LauncherProfile> {
  return apiRequest<LauncherProfile>("/v1/profiles", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function deleteProfile(profileId: string): Promise<void> {
  await apiRequest<void>(`/v1/profiles/${profileId}`, { method: "DELETE" });
}

export async function duplicateProfile(
  profileId: string,
): Promise<LauncherProfile> {
  return apiRequest<LauncherProfile>(`/v1/profiles/${profileId}/duplicate`, {
    method: "POST",
  });
}

export async function favoriteProfile(
  profileId: string,
): Promise<LauncherProfile> {
  return apiRequest<LauncherProfile>(`/v1/profiles/${profileId}/favorite`, {
    method: "POST",
  });
}

export async function updateProfile(
  profileId: string,
  patch: Partial<CreateLauncherProfileRequest>,
): Promise<LauncherProfile> {
  return apiRequest<LauncherProfile>(`/v1/profiles/${profileId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function exportProfile(
  profileId: string,
): Promise<LauncherProfile> {
  return apiRequest<LauncherProfile>(`/v1/profiles/${profileId}/export`);
}

export async function importProfile(
  input: CreateLauncherProfileRequest,
): Promise<LauncherProfile> {
  return apiRequest<LauncherProfile>("/v1/profiles/import", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Un profil cree par un import, avec ce qui n'a pas pu etre repris. */
export type ImportedProfile = LauncherProfile & { warnings?: string[] };

export async function migrateProfile(
  input: CreateLauncherProfileRequest,
): Promise<ImportedProfile> {
  return apiRequest<ImportedProfile>("/v1/profiles/migrate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function importArchive(archivePath: string): Promise<ImportedProfile> {
  return apiRequest<ImportedProfile>("/v1/profiles/import-archive", {
    method: "POST",
    body: JSON.stringify({ archivePath }),
  });
}

export interface KeybindImportResult {
  applied: number;
  unchanged: number;
}

/** Reprend les touches d'une autre instance du launcher ou d'un autre launcher. */
export async function importKeybinds(
  profileId: string,
  source: { sourceProfileId: string } | { sourceOptionsPath: string },
): Promise<KeybindImportResult> {
  return apiRequest<KeybindImportResult>(`/v1/profiles/${profileId}/import-keybinds`, {
    method: "POST",
    body: JSON.stringify(source),
  });
}

export type SourceInfo = {
  optionsPath: string;
  modCount: number;
  name?: string;
  minecraftVersion?: string;
  profileTypeId?: "fabric" | "vanilla";
  unsupportedLoader?: string;
};

/** Version, loader et nombre de mods d'instances d'autres launchers. */
export async function inspectSources(paths: string[]): Promise<SourceInfo[]> {
  return apiRequest<SourceInfo[]>("/v1/profiles/inspect-sources", {
    method: "POST",
    body: JSON.stringify({ paths }),
  });
}

/** Importe un fichier .lcpack ou .paraconf; les archives passent par importArchive. */
export async function importPaths(paths: string[]): Promise<void> {
  await apiRequest<unknown>("/v1/profiles/import-paths", {
    method: "POST",
    body: JSON.stringify({ paths }),
  });
}

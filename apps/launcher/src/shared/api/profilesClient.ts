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

export async function migrateProfile(
  input: CreateLauncherProfileRequest,
): Promise<LauncherProfile> {
  return apiRequest<LauncherProfile>("/v1/profiles/migrate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function importArchive(archivePath: string): Promise<LauncherProfile> {
  return apiRequest<LauncherProfile>("/v1/profiles/import-archive", {
    method: "POST",
    body: JSON.stringify({ archivePath }),
  });
}

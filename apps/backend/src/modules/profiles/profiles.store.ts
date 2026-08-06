import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { paranoiaDataDir } from "../launcher/paths.js";

export interface StoredLauncherProfile {
  id: string;
  name: string;
  minecraftVersion: string;
  profileTypeId: string;
  graphicsModeId: string;
  favorite: boolean;
  ramMb: number;
  resolution: string;
  optionsTxtPath?: string;
  createdAt: string;
  updatedAt: string;
}

// Dossier de donnees de l'utilisateur, et non process.cwd(): une fois
// l'application installee, le repertoire courant est celui du programme
// (C:\Program Files\...), ou un compte standard n'a pas le droit d'ecrire.
const DB_PATH = join(paranoiaDataDir(), "profiles.json");

function ensureStore() {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, "[]", "utf-8");
  }
}

function readAll(): StoredLauncherProfile[] {
  ensureStore();
  const raw = readFileSync(DB_PATH, "utf-8");
  return JSON.parse(raw) as StoredLauncherProfile[];
}

function writeAll(profiles: StoredLauncherProfile[]) {
  ensureStore();
  writeFileSync(DB_PATH, JSON.stringify(profiles, null, 2), "utf-8");
}

export function listProfiles(): StoredLauncherProfile[] {
  return readAll();
}

export function createProfile(
  input: Omit<
    StoredLauncherProfile,
    "id" | "favorite" | "createdAt" | "updatedAt"
  >,
): StoredLauncherProfile {
  const profiles = readAll();
  const now = new Date().toISOString();
  const profile: StoredLauncherProfile = {
    id: randomUUID(),
    favorite: profiles.length === 0,
    createdAt: now,
    updatedAt: now,
    ...input,
  };

  profiles.push(profile);
  writeAll(profiles);
  return profile;
}

export function updateProfile(
  profileId: string,
  patch: Partial<
    Pick<
      StoredLauncherProfile,
      | "name"
      | "minecraftVersion"
      | "profileTypeId"
      | "graphicsModeId"
      | "ramMb"
      | "resolution"
    >
  >,
): StoredLauncherProfile | null {
  const profiles = readAll();
  const index = profiles.findIndex((p) => p.id === profileId);
  if (index < 0) {
    return null;
  }

  const updated = { ...profiles[index], ...patch, updatedAt: new Date().toISOString() } as StoredLauncherProfile;

  profiles[index] = updated;
  writeAll(profiles);
  return updated;
}

export function deleteProfile(profileId: string): boolean {
  const profiles = readAll();
  const next = profiles.filter((p) => p.id !== profileId);

  if (next.length === profiles.length) {
    return false;
  }

  if (!next.some((p) => p.favorite) && next.length > 0) {
    next[0] = {
      ...next[0],
      favorite: true,
      updatedAt: new Date().toISOString(),
    } as StoredLauncherProfile;
  }

  writeAll(next);
  return true;
}

export function duplicateProfile(
  profileId: string,
): StoredLauncherProfile | null {
  const profiles = readAll();
  const source = profiles.find((p) => p.id === profileId);
  if (!source) {
    return null;
  }

  const now = new Date().toISOString();
  const duplicate: StoredLauncherProfile = {
    ...source,
    id: randomUUID(),
    name: `${source.name} (copy)`,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };

  profiles.push(duplicate);
  writeAll(profiles);
  return duplicate;
}

export function setFavorite(profileId: string): StoredLauncherProfile | null {
  const profiles = readAll();
  let selected: StoredLauncherProfile | null = null;
  const now = new Date().toISOString();

  const next = profiles.map((profile) => {
    const favorite = profile.id === profileId;
    if (favorite) {
      selected = { ...profile, favorite: true, updatedAt: now };
      return selected;
    }

    if (profile.favorite) {
      return { ...profile, favorite: false, updatedAt: now };
    }

    return profile;
  });

  if (!selected) {
    return null;
  }

  writeAll(next);
  return selected;
}

export function exportProfile(profileId: string): StoredLauncherProfile | null {
  return readAll().find((p) => p.id === profileId) ?? null;
}

export function importProfile(
  profile: Omit<
    StoredLauncherProfile,
    "id" | "favorite" | "createdAt" | "updatedAt"
  >,
): StoredLauncherProfile {
  return createProfile(profile);
}

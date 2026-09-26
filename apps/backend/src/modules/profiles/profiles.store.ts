import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
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
  optionsTxtPath?: string | undefined;
  createdAt: string;
  updatedAt: string;
  /**
   * Dernier lancement du jeu depuis cette instance.
   *
   * <p>Absent tant qu'elle n'a jamais servi, et c'est ce qui la distingue
   * d'une instance jouee il y a longtemps.
   *
   * <p>Un champ a part, et non {@code updatedAt}: celui-ci bouge a chaque
   * modification, y compris une mise en favori ou un changement de nom.
   * S'en servir pour l'ordre aurait fait remonter en tete une instance qu'on
   * vient de renommer sans y avoir joue.
   */
  lastPlayedAt?: string | undefined;
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

/**
 * Les instances, la derniere jouee en tete.
 *
 * <p>L'ordre est rendu ici et non dans l'interface: le launcher, l'ecran des
 * versions et le choix de l'instance par defaut lisent tous cette liste, et
 * trois tris ecrits separement finissent par diverger.
 *
 * <p>Celles qui n'ont jamais servi viennent ensuite, de la plus recente a la
 * plus ancienne. Une instance qu'on vient de creer est donc juste sous celles
 * qu'on utilise, et non au fond de la liste.
 */
export function listProfiles(): StoredLauncherProfile[] {
  return readAll().sort((a, b) => {
    if (a.lastPlayedAt && b.lastPlayedAt) {
      return b.lastPlayedAt.localeCompare(a.lastPlayedAt);
    }
    if (a.lastPlayedAt) return -1;
    if (b.lastPlayedAt) return 1;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

/** Note qu'on vient de lancer le jeu depuis cette instance. */
export function markProfilePlayed(profileId: string): void {
  const profiles = readAll();
  const index = profiles.findIndex((p) => p.id === profileId);
  if (index < 0) {
    return;
  }

  // `updatedAt` n'est deliberement pas touche: le lancement n'est pas une
  // modification de l'instance, et le confondre avec une edition ferait
  // mentir les deux champs a la fois.
  profiles[index] = {
    ...profiles[index],
    lastPlayedAt: new Date().toISOString(),
  } as StoredLauncherProfile;
  writeAll(profiles);
}

function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || "instance";
}

function generateProfileId(name: string, existingIds: Set<string>): string {
  const base = slugify(name);
  if (!existingIds.has(base)) {
    return base;
  }
  let counter = 2;
  while (existingIds.has(`${base}-${counter}`)) {
    counter++;
  }
  return `${base}-${counter}`;
}

export function createProfile(
  input: Omit<
    StoredLauncherProfile,
    "id" | "favorite" | "createdAt" | "updatedAt"
  >,
): StoredLauncherProfile {
  const profiles = readAll();
  const now = new Date().toISOString();
  const existingIds = new Set(profiles.map((p) => p.id));
  const profile: StoredLauncherProfile = {
    id: generateProfileId(input.name, existingIds),
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
  const existingIds = new Set(profiles.map((p) => p.id));
  const newName = `${source.name} (copy)`;
  const duplicate: StoredLauncherProfile = {
    ...source,
    id: generateProfileId(newName, existingIds),
    name: newName,
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

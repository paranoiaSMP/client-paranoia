import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { paranoiaDataDir } from "../launcher/paths.js";
import type { MinecraftAccountTokens } from "./auth.microsoft.js";

export interface StoredAccount {
  id: string;
  minecraftUuid: string;
  minecraftUsername: string;
  skinUrl: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
}

const DB_PATH = join(paranoiaDataDir(), "accounts.json");

/**
 * The file holds Minecraft session tokens, so it is created 0600: readable by
 * the player's account only. Windows ignores the mode, hence the try/catch.
 */
function ensureStore() {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  if (!existsSync(DB_PATH)) {
    writeFileSync(DB_PATH, "[]", { encoding: "utf-8", mode: 0o600 });
  }

  try {
    chmodSync(DB_PATH, 0o600);
  } catch {
    // systeme de fichiers sans permissions POSIX
  }
}

function normalizeUuid(uuid: string): string {
  return (uuid || "").replace(/-/g, "").toLowerCase();
}

function deduplicate(accounts: StoredAccount[]): StoredAccount[] {
  const seen = new Set<string>();
  const clean: StoredAccount[] = [];
  for (const acc of accounts) {
    const key =
      normalizeUuid(acc.minecraftUuid) ||
      (acc.minecraftUsername || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    clean.push(acc);
  }
  return clean;
}

function readAll(): StoredAccount[] {
  ensureStore();
  try {
    const parsed = JSON.parse(readFileSync(DB_PATH, "utf-8"));
    if (!Array.isArray(parsed)) return [];
    const deduped = deduplicate(parsed as StoredAccount[]);
    if (deduped.length !== parsed.length) {
      writeAll(deduped);
    }
    return deduped;
  } catch {
    return [];
  }
}

function writeAll(accounts: StoredAccount[]) {
  ensureStore();
  writeFileSync(DB_PATH, JSON.stringify(accounts, null, 2), {
    encoding: "utf-8",
    mode: 0o600,
  });
}

export function listAccounts(): StoredAccount[] {
  return readAll();
}

export function getAccount(id: string): StoredAccount | null {
  return readAll().find((account) => account.id === id) ?? null;
}

export function saveAccount(tokens: MinecraftAccountTokens): StoredAccount {
  const accounts = readAll();
  const targetUuid = normalizeUuid(tokens.minecraftUuid);
  const targetUser = (tokens.minecraftUsername || "").toLowerCase();

  const existing = accounts.find(
    (account) =>
      (targetUuid && normalizeUuid(account.minecraftUuid) === targetUuid) ||
      (targetUser &&
        (account.minecraftUsername || "").toLowerCase() === targetUser),
  );

  const account: StoredAccount = {
    id: existing?.id ?? randomUUID(),
    minecraftUuid: tokens.minecraftUuid,
    minecraftUsername: tokens.minecraftUsername,
    skinUrl: tokens.skinUrl ?? "",
    accessToken: tokens.minecraftAccessToken,
    refreshToken: tokens.microsoftRefreshToken,
    expiresAt: tokens.expiresAt,
  };

  const next = accounts.filter(
    (entry) =>
      entry.id !== account.id &&
      (!targetUuid || normalizeUuid(entry.minecraftUuid) !== targetUuid) &&
      (!targetUser ||
        (entry.minecraftUsername || "").toLowerCase() !== targetUser),
  );
  next.push(account);

  writeAll(next);
  return account;
}

export function deleteAccount(id: string): boolean {
  const accounts = readAll();
  const next = accounts.filter((account) => account.id !== id);
  if (next.length === accounts.length) {
    return false;
  }

  writeAll(next);
  return true;
}

/** A session about to expire is treated as expired, to avoid racing the launch. */
export function isExpired(account: StoredAccount, marginMs = 5 * 60 * 1000) {
  const expiry = Date.parse(account.expiresAt);
  if (Number.isNaN(expiry)) {
    return true;
  }
  return expiry - marginMs <= Date.now();
}

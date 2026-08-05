import { randomBytes, timingSafeEqual } from "node:crypto";

interface AuthStateRecord {
  redirectUri: string;
  createdAt: number;
}

const TTL_MS = 10 * 60 * 1000;
const stateStore = new Map<string, AuthStateRecord>();

function cleanup() {
  const now = Date.now();
  for (const [state, record] of stateStore.entries()) {
    if (now - record.createdAt > TTL_MS) {
      stateStore.delete(state);
    }
  }
}

/** Issue a single-use CSRF token bound to the redirect URI it was created for. */
export function createAuthState(redirectUri: string): string {
  cleanup();
  const state = randomBytes(24).toString("base64url");
  stateStore.set(state, { redirectUri, createdAt: Date.now() });
  return state;
}

/**
 * Validate and burn a state token. Returns the redirect URI it was issued for,
 * or null when the token is unknown, already used, or expired.
 */
export function consumeAuthState(
  state: string,
): { redirectUri: string } | null {
  cleanup();

  if (typeof state !== "string" || state.length === 0) {
    return null;
  }

  const record = stateStore.get(state);
  if (!record) {
    return null;
  }

  stateStore.delete(state);
  return { redirectUri: record.redirectUri };
}

/** Constant-time comparison, so a mismatch does not leak its position by timing. */
export function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

import { randomBytes } from "node:crypto";

interface AuthStateRecord {
  codeVerifier: string;
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

export function createAuthState(codeVerifier: string): string {
  cleanup();
  const state = randomBytes(24).toString("base64url");
  stateStore.set(state, { codeVerifier, createdAt: Date.now() });
  return state;
}

export function consumeAuthState(state: string): string | null {
  cleanup();
  const record = stateStore.get(state);
  if (!record) {
    return null;
  }

  stateStore.delete(state);
  return record.codeVerifier;
}

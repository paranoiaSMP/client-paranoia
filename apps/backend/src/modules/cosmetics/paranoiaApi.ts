import type { StoredAccount } from "../auth/accounts.store.js";

/**
 * Client du service heberge, pour le compte du joueur connecte au launcher.
 *
 * <p>Le jeton d'API reste ici, dans le processus local, et ne descend jamais
 * dans la webview: une page qui detient un jeton peut le fuiter par une
 * dependance, une extension ou un simple copier-coller de console. Le
 * vestiaire appelle donc le sidecar, qui appelle l'API.
 *
 * <p>Le jeton de session Minecraft, lui, ne quitte pas cette machine
 * autrement que vers Mojang -- l'API Paranoia ne le voit jamais.
 */
const DEFAULT_BASE_URL = "https://api.paranoiastudio.fr";
const MOJANG_JOIN_URL = "https://sessionserver.mojang.com/session/minecraft/join";

function baseUrl(): string {
  const configured = process.env.PARANOIA_API_BASE_URL?.trim() || DEFAULT_BASE_URL;
  return configured.endsWith("/") ? configured.slice(0, -1) : configured;
}

interface Session {
  token: string;
  expiresAt: number;
}

/** Un jeton par compte: le launcher peut en stocker plusieurs. */
const sessions = new Map<string, Session>();

export class ParanoiaApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    signal: AbortSignal.timeout(15_000),
    headers: { accept: "application/json", ...(init.headers ?? {}) },
  });

  if (!response.ok) {
    let detail = `Reponse ${response.status}`;
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) {
        detail = body.error;
      }
    } catch {
      // Corps illisible: le code seul suffit a expliquer l'echec.
    }
    throw new ParanoiaApiError(response.status, detail);
  }

  return (await response.json()) as T;
}

/**
 * Prouve a l'API que ce compte nous appartient, via Mojang.
 *
 * <p>Exactement le handshake que fait tout serveur Minecraft en ligne. Sans
 * lui, une requete HTTP suffirait a depenser les paracoins de n'importe qui.
 */
async function authenticate(account: StoredAccount): Promise<string> {
  const { serverId } = await call<{ serverId: string }>("/v1/auth/begin", { method: "POST" });

  const join = await fetch(MOJANG_JOIN_URL, {
    method: "POST",
    signal: AbortSignal.timeout(15_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      accessToken: account.accessToken,
      // Sans tirets: c'est la forme qu'attend cette route, et l'envoyer
      // avec fait echouer la jointure sans message clair.
      selectedProfile: account.minecraftUuid.replaceAll("-", ""),
      serverId,
    }),
  });

  if (join.status !== 204 && join.status !== 200) {
    throw new ParanoiaApiError(
      join.status,
      "Session Minecraft refusee par Mojang. Reconnecte ton compte dans le launcher.",
    );
  }

  const issued = await call<{ token: string; expiresIn: number }>("/v1/auth/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: account.minecraftUsername, serverId }),
  });

  sessions.set(account.id, {
    token: issued.token,
    // Une minute de marge: un jeton qui expire pendant l'aller-retour
    // produirait un 401 que l'utilisateur verrait comme une panne.
    expiresAt: Date.now() + (issued.expiresIn - 60) * 1000,
  });

  return issued.token;
}

async function tokenFor(account: StoredAccount): Promise<string> {
  const existing = sessions.get(account.id);
  if (existing && existing.expiresAt > Date.now()) {
    return existing.token;
  }
  return authenticate(account);
}

/**
 * Appelle l'API au nom du compte, en refaisant le handshake si besoin.
 *
 * <p>Le 401 est rattrape une fois: le service redemarre de temps en temps et
 * ses jetons vivent en memoire. Laisser remonter l'erreur montrerait au
 * joueur une panne la ou une seconde de latence suffit.
 */
async function withToken<T>(account: StoredAccount, path: string, init: RequestInit = {}) {
  const request = async (token: string) =>
    call<T>(path, { ...init, headers: { ...(init.headers ?? {}), authorization: `Bearer ${token}` } });

  try {
    return await request(await tokenFor(account));
  } catch (err) {
    if (err instanceof ParanoiaApiError && err.status === 401) {
      sessions.delete(account.id);
      return request(await authenticate(account));
    }
    throw err;
  }
}

export interface CosmeticsProfile {
  uuid: string;
  username: string;
  /** `null` signifie illimite: le compte est administrateur. */
  balance: number | null;
  admin: boolean;
  owned: string[];
  equipped: string[];
}

export function fetchCatalog() {
  return call<unknown[]>("/v1/cosmetics/catalog");
}

export function fetchProfile(account: StoredAccount) {
  return withToken<CosmeticsProfile>(account, "/v1/cosmetics/me");
}

export function purchase(account: StoredAccount, id: string) {
  return withToken<{ balance: number | null; owned: string[] }>(
    account,
    "/v1/cosmetics/purchase",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    },
  );
}

export function setEquipped(account: StoredAccount, ids: string[]) {
  return withToken<{ equipped: string[] }>(account, "/v1/cosmetics/equipped", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ids }),
  });
}

/** Uniquement pour les tests: oublie les jetons en cache. */
export function resetSessions(): void {
  sessions.clear();
}

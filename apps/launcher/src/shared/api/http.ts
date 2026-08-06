// `.env.example` documente PARANOIA_API_BASE_URL et vite.config.ts expose les
// deux prefixes; on accepte donc les deux noms plutot que d'ignorer en silence
// la variable telle qu'elle est documentee.
// Le backend est embarque dans l'application (sidecar Tauri) et ecoute en local
// sur ce port dedie. Il doit rester aligne avec PORT dans apps/backend et avec
// le connect-src de la CSP dans tauri.conf.json.
export const DEFAULT_API_BASE_URL = "http://127.0.0.1:47820";

const API_BASE_URL =
  import.meta.env?.VITE_PARANOIA_API_BASE_URL ||
  import.meta.env?.PARANOIA_API_BASE_URL ||
  DEFAULT_API_BASE_URL;

export { API_BASE_URL };

async function errorMessage(response: Response): Promise<string> {
  const body = await response.text();

  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed.message) {
      return parsed.message;
    }
  } catch {
    // reponse non JSON: on retombe sur le corps brut
  }

  return body || `${response.status} ${response.statusText}`;
}

/**
 * Le backend est demarre par Tauri en meme temps que la fenetre et met environ
 * une seconde a ecouter. Sans cette attente, le premier chargement partait en
 * erreur reseau alors que tout allait bien une seconde plus tard.
 */
export async function waitForApi(timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${API_BASE_URL}/health`);
      if (response.ok) {
        return;
      }
      lastError = new Error(`health ${response.status}`);
    } catch (err) {
      lastError = err;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(
    `Le service local n'a pas demarre (${API_BASE_URL}). ` +
      `Derniere erreur: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

export async function apiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    // Doit rester apres le spread: place avant, un init.headers ecrasait
    // l'objet entier et faisait disparaitre le Content-Type.
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

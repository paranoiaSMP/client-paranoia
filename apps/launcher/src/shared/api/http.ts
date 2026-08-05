// `.env.example` documente PARANOIA_API_BASE_URL et vite.config.ts expose les
// deux prefixes; on accepte donc les deux noms plutot que d'ignorer en silence
// la variable telle qu'elle est documentee.
const API_BASE_URL =
  import.meta.env?.VITE_PARANOIA_API_BASE_URL ||
  import.meta.env?.PARANOIA_API_BASE_URL ||
  "http://localhost:8080";

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

import type { NewsItem, ServerStatus } from "@paranoia/contracts";
import { apiRequest } from "./http";

export async function fetchNews(): Promise<NewsItem[]> {
  // Si une URL externe est définie dans le fichier .env, on l'utilise
  const externalNewsUrl = import.meta.env?.VITE_NEWS_URL;
  if (externalNewsUrl) {
    try {
      const response = await fetch(externalNewsUrl);
      if (response.ok) {
        return (await response.json()) as NewsItem[];
      }
    } catch (e) {
      console.error("Impossible de charger les news externes :", e);
    }
  }

  // Sinon on utilise l'API backend locale
  return apiRequest<NewsItem[]>("/v1/news");
}

export async function fetchServerStatus(): Promise<ServerStatus> {
  return apiRequest<ServerStatus>("/v1/server-status");
}

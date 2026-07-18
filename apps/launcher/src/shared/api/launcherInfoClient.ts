import type { NewsItem, ServerStatus } from "@paranoia/contracts";
import { apiRequest } from "./http";

export async function fetchNews(): Promise<NewsItem[]> {
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

  return apiRequest<NewsItem[]>("/v1/news");
}

export async function fetchServerStatus(): Promise<ServerStatus> {
  return apiRequest<ServerStatus>("/v1/server-status");
}

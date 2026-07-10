import type { NewsItem, ServerStatus } from "@paranoia/contracts";
import { apiRequest } from "./http";

export async function fetchNews(): Promise<NewsItem[]> {
  return apiRequest<NewsItem[]>("/v1/news");
}

export async function fetchServerStatus(): Promise<ServerStatus> {
  return apiRequest<ServerStatus>("/v1/server-status");
}

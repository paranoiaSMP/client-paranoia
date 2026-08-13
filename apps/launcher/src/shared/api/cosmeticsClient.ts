import type { CosmeticItem } from "@paranoia/contracts";
import { apiRequest } from "./http";

export async function fetchCosmetics(): Promise<CosmeticItem[]> {
  return apiRequest<CosmeticItem[]>("/v1/cosmetics/catalog");
}

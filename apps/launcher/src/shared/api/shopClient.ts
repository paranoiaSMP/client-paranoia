import type { ShopItem, UserBalance } from "@paranoia/contracts";
import { apiRequest } from "./http";

/**
 * Recupere le catalogue de la boutique.
 */
export async function getShopCatalog(): Promise<ShopItem[]> {
  return apiRequest<ShopItem[]>("/v1/shop/catalog");
}

/**
 * Recupere le solde de Paracoins d'un utilisateur.
 */
export async function getUserBalance(uuid: string): Promise<UserBalance> {
  return apiRequest<UserBalance>(`/v1/shop/balance/${encodeURIComponent(uuid)}`);
}

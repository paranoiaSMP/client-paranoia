import { useEffect, useState } from "react";
import { ShoppingCart, Coins, Box } from "lucide-react";
import type { ShopItem } from "@paranoia/contracts";
import { getShopCatalog, getUserBalance } from "../../../shared/api/shopClient";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";

export function BoutiqueTab({ accountUuid }: { accountUuid?: string }) {
  const { t } = useTranslation();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [catalog, userBalance] = await Promise.all([
          getShopCatalog(),
          accountUuid ? getUserBalance(accountUuid) : Promise.resolve({ balance: 0 })
        ]);
        setItems(catalog);
        setBalance(userBalance.balance);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de chargement de la boutique");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [accountUuid]);

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <span className="text-white/60 text-sm">{t("app.loading", "Chargement...")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 p-6 overflow-y-auto">
      {/* En-tête avec solde */}
      <div className="flex items-center justify-between rounded-xl bg-[#2a133f]/40 border border-[#9309ef]/30 p-5 shadow-lg">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-accent-purple" />
            Boutique Paranoia
          </h2>
          <p className="text-[#a1a1aa] text-sm mt-1">Découvrez nos grades et cosmétiques exclusifs.</p>
        </div>
        <div className="flex items-center gap-3 bg-[#1e1e1e] border border-[#333] px-4 py-2.5 rounded-lg shadow-inner">
          <Coins className="w-5 h-5 text-yellow-400" />
          <div className="flex flex-col">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Solde</span>
            <span className="text-white font-bold">{balance} Paracoins</span>
          </div>
        </div>
      </div>

      {/* Grille des articles */}
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#71717a]">La boutique est vide pour le moment.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((item) => (
            <article key={item.id} className="flex flex-col overflow-hidden rounded-xl bg-[#1e1e1e] border border-[#333] hover:border-[#555] transition-colors shadow-md group">
              <div className="h-40 bg-[#141414] overflow-hidden relative">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Box className="w-10 h-10 text-gray-600" />
                  </div>
                )}
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded text-xs font-medium text-white border border-white/10">
                  {item.category}
                </div>
              </div>
              <div className="flex flex-col p-4 flex-1">
                <h3 className="text-lg font-bold text-white leading-tight">{item.name}</h3>
                <p className="text-sm text-gray-400 mt-1.5 flex-1 line-clamp-2">{item.description}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="font-bold text-yellow-400 flex items-center gap-1.5">
                    {item.price} <Coins className="w-4 h-4" />
                  </span>
                  <button
                    onClick={() => openUrl(item.checkoutUrl)}
                    className="bg-accent-purple hover:bg-accent-purple-dark text-white px-4 py-1.5 rounded-lg font-medium text-sm transition-colors shadow-sm"
                  >
                    Acheter
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

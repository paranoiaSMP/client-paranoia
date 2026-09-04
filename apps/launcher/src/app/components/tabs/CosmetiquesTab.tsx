import { useEffect, useState } from "react";
import { Loader2, Shirt } from "lucide-react";
import type { CosmeticItem } from "@paranoia/contracts";
import { fetchCosmetics } from "../../../shared/api/cosmeticsClient";

const RARITY_COLORS: Record<CosmeticItem["rarity"], string> = {
  common: "border-[#372d58] text-[#9a92b6]",
  rare: "border-sky-500/60 text-sky-300",
  epic: "border-fuchsia-500/60 text-fuchsia-300",
  legendary: "border-amber-500/60 text-amber-300",
};

/**
 * Catalogue de cosmetiques.
 *
 * <p>Le point d'entree {@code /v1/cosmetics/catalog} existe et rend pour
 * l'instant une liste vide: c'est une ebauche cote serveur, pas une panne. Le
 * panneau le dit plutot que d'afficher un chargement sans fin ou une erreur.
 */
export function CosmetiquesTab() {
  const [items, setItems] = useState<CosmeticItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchCosmetics()
      .then((catalog) => {
        if (!cancelled) setItems(catalog);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Catalogue indisponible");
          setItems([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (items === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#7a7194]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Chargement du catalogue...
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <Shirt className="h-10 w-10 text-[#372d58]" />
        <p className="text-sm font-semibold text-white">
          Aucun cosmetique pour l'instant
        </p>
        <p className="max-w-sm text-xs text-[#7a7194]">
          Le catalogue est servi par le backend et ne contient encore aucune
          piece. Les capes, ailes et particules apparaitront ici des qu'elles y
          seront ajoutees.
        </p>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item) => (
        <article
          key={item.id}
          className={`overflow-hidden rounded-xl border bg-[#161225] ${RARITY_COLORS[item.rarity]}`}
        >
          <img
            src={item.previewUrl}
            alt=""
            className="h-24 w-full object-cover"
          />
          <div className="p-2.5">
            <p className="truncate text-sm font-semibold text-white">
              {item.name}
            </p>
            <p className="text-[10px] uppercase tracking-wider">
              {item.type} &middot; {item.rarity}
            </p>
          </div>
        </article>
      ))}
    </div>
  );
}

import { useEffect, useState } from "react";

import { apiRequest } from "../../shared/api/http";

type CosmeticItem = {
	id: string;
	type: string;
	textureUrl?: string;
	previewUrl: string;
};

/**
 * La cape portee, pour que le personnage de l'accueil la montre.
 *
 * <p>Relue a l'ouverture puis a chaque fermeture du vestiaire: c'est le seul
 * moment ou l'equipement peut avoir change.
 *
 * <p>Un service injoignable ou un compte deconnecte rend {@code undefined}
 * plutot qu'une erreur: le personnage s'affiche alors sans cape, ce qui est
 * exactement ce qu'il faut montrer.
 */
export function useLobbyCape(wardrobeOpen: boolean): string | undefined {
	const [lobbyCape, setLobbyCape] = useState<string | undefined>();

	useEffect(() => {
		let annule = false;

		void (async () => {
			try {
				const [items, me] = await Promise.all([
					apiRequest<CosmeticItem[]>("/v1/cosmetics/catalog"),
					apiRequest<{ equipped: string[] }>("/v1/cosmetics/me"),
				]);

				const cape = items.find(
					(item) => item.type === "cape" && me.equipped.includes(item.id),
				);
				if (!annule) {
					setLobbyCape(cape?.textureUrl ?? cape?.previewUrl);
				}
			} catch {
				if (!annule) {
					setLobbyCape(undefined);
				}
			}
		})();

		return () => {
			annule = true;
		};
	}, [wardrobeOpen]);

	return lobbyCape;
}

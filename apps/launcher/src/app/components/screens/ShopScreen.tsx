import { Store } from "lucide-react";

import { ScreenHeader } from "./ScreenHeader";

/**
 * La boutique, pas encore ouverte.
 *
 * <p>L'ecran existe et l'entree est visible dans la barre laterale, marquee
 * « a venir ». C'est un choix de la maquette et il se defend: une entree
 * annoncee absente vaut mieux qu'une entree qui apparait un jour sans
 * prevenir, et elle donne une place ou brancher la boutique le moment venu.
 */
export function ShopScreen() {
	return (
		<div className="flex min-h-0 flex-1 flex-col items-start gap-4 overflow-auto p-6">
			<ScreenHeader
				title="Boutique"
				subtitle="Capes, packs et passes de saison Paranoia."
			/>

			<div className="elev-sm flex items-center gap-3 rounded-lg border-2 border-divider bg-surface p-4">
				<Store className="size-[26px] shrink-0 text-accent-300" />
				<span className="flex flex-col gap-px">
					<span className="text-[15px] font-semibold">Bientôt disponible</span>
					<span className="text-[13px] text-neutral-300">
						La boutique ouvrira avec la saison 6.
					</span>
				</span>
			</div>
		</div>
	);
}

import type { LauncherProfile } from "@paranoia/contracts";

import { ModsTab } from "../tabs/ModsTab";
import { ScreenHeader } from "./ScreenHeader";

type ModsScreenProps = {
	profiles: LauncherProfile[];
	selectedProfileId: string;
	setSelectedProfileId: (id: string) => void;
	modCount: number | null;
	setError: (message: string | null) => void;
};

/**
 * Le gestionnaire de mods.
 *
 * <p>L'ecran n'apporte que l'en-tete: la recherche Modrinth, l'installation et
 * la liste des mods poses restent dans {@code ModsTab}, qui les portait deja et
 * les porte bien. Reecrire ce contenu pour l'occasion aurait remplace du code
 * eprouve par du code neuf sans rien gagner a l'ecran.
 */
export function ModsScreen({
	profiles,
	selectedProfileId,
	setSelectedProfileId,
	modCount,
	setError,
}: ModsScreenProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
			<ScreenHeader
				title="Mods"
				subtitle={
					modCount === null
						? "Recherche et installation depuis Modrinth."
						: `${modCount} mod${modCount > 1 ? "s" : ""} installé${modCount > 1 ? "s" : ""} sur l'instance courante.`
				}
			/>

			<ModsTab
				profiles={profiles}
				selectedProfileId={selectedProfileId}
				setSelectedProfileId={setSelectedProfileId}
				setError={setError}
			/>
		</div>
	);
}

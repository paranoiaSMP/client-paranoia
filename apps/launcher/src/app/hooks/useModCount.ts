import { useEffect, useState } from "react";
import type { LauncherProfile } from "@paranoia/contracts";

import { listInstalledMods } from "../../shared/api/modsClient";

/**
 * Combien de mods sont installes dans le profil courant.
 *
 * <p>Relu a chaque changement d'ecran, d'ou la dependance sur celui-ci: quitter
 * le gestionnaire de mods est le seul moment ou le compte peut avoir change, et
 * interroger en boucle pour une donnee qui bouge deux fois par session serait
 * du gaspillage. Le compteur de la barre laterale est ainsi a jour des qu'on
 * revient sur l'accueil.
 *
 * <p>{@code null} veut dire « inconnu » et non « zero »: sans profil, ou si le
 * service ne repond pas, l'affichage doit se taire plutot qu'annoncer un
 * compte faux.
 */
export function useModCount(
	profile: LauncherProfile | null,
	screen: string,
): number | null {
	const [modCount, setModCount] = useState<number | null>(null);
	const profileId = profile?.id;

	useEffect(() => {
		let cancelled = false;

		if (!profileId) {
			setModCount(null);
			return;
		}

		listInstalledMods(profileId)
			.then((mods) => {
				if (!cancelled) setModCount(mods.length);
			})
			.catch(() => {
				if (!cancelled) setModCount(null);
			});

		return () => {
			cancelled = true;
		};
	}, [profileId, screen]);

	return modCount;
}

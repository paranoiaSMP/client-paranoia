import { useEffect, useState } from "react";
import type { LauncherProfile } from "@paranoia/contracts";

import { listInstalledMods } from "../../shared/api/modsClient";

/**
 * Le nombre de mods de chaque instance, par identifiant.
 *
 * <p>Tous les mods du dossier, desactives compris: c'est le compte de la barre
 * laterale et de la fiche, et trois chiffres differents pour la meme instance
 * seraient pire qu'aucun.
 *
 * <p>`undefined` pour une instance dont le compte n'est pas encore arrive, et
 * `null` quand la lecture a echoue: l'ecran montre un emplacement vide dans le
 * premier cas et un tiret dans le second, au lieu d'afficher un zero faux.
 */
export function useModCounts(profiles: LauncherProfile[]): Record<string, number | null | undefined> {
	const [counts, setCounts] = useState<Record<string, number | null | undefined>>({});
	const key = profiles.map((p) => p.id).join("|");

	useEffect(() => {
		let cancelled = false;

		for (const profile of profiles) {
			listInstalledMods(profile.id, "mod")
				.then((mods) => mods.length)
				.catch(() => null)
				.then((count) => {
					if (!cancelled) setCounts((current) => ({ ...current, [profile.id]: count }));
				});
		}

		return () => {
			cancelled = true;
		};
		// profiles est resume par `key`: la liste change de reference a chaque
		// actualisation sans que les instances changent.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [key]);

	return counts;
}

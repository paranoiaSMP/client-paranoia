import { useCallback, useEffect, useState } from "react";

import {
	fetchSettings,
	type LauncherSettings,
} from "../../shared/api/settingsClient";

/**
 * Les reglages du launcher, charges une fois pour toute l'application.
 *
 * <p>Ils etaient lus par l'onglet Parametres seul. Le bandeau du bas affiche
 * desormais la memoire allouee, et deux lectures independantes auraient fini
 * par se contredire: le bandeau aurait continue d'annoncer l'ancienne valeur
 * apres un enregistrement, jusqu'au prochain demarrage.
 *
 * <p>{@code reload} est donc rappele par l'ecran des parametres apres une
 * sauvegarde reussie: c'est ce qui garde les deux affichages d'accord.
 */
export function useSettings() {
	const [settings, setSettings] = useState<LauncherSettings | null>(null);

	const reload = useCallback(async () => {
		try {
			setSettings(await fetchSettings());
		} catch {
			// Le service local peut ne pas encore repondre au premier rendu. Les
			// ecrans savent afficher l'absence de reglages; ils ne savent pas
			// afficher une erreur qui les remplacerait.
		}
	}, []);

	useEffect(() => {
		void reload();
	}, [reload]);

	return { settings, reload };
}

import { useEffect, useState } from "react";
import type { NewsItem, RemoteConfiguration } from "@paranoia/contracts";

import { fetchRemoteConfiguration } from "../../shared/api/catalogClient";
import { fetchNews } from "../../shared/api/launcherInfoClient";
import { waitForApi } from "../../shared/api/http";

type UseBootstrapOptions = {
	/** Recharge la liste des profils, en parallele du catalogue. */
	refreshProfiles: () => Promise<unknown>;
	setError: (message: string | null) => void;
	/** Message affiche quand l'echec n'est pas une Error. */
	fallbackError: string;
};

/**
 * Le premier chargement: attendre le service local, puis lire le catalogue,
 * les profils et les actualites.
 *
 * <p>{@code waitForApi} passe en premier et n'est pas une precaution de style:
 * le backend est un processus voisin demarre par Tauri en meme temps que la
 * fenetre, et il met environ une seconde a ecouter.
 *
 * <p>{@code failed} et {@code loading} sont distincts. Un echec laisse un
 * ecran qui explique et propose de reessayer; un chargement laisse un ecran
 * d'attente. Les confondre donnerait un launcher qui tourne indefiniment
 * quand le service ne demarre pas.
 */
export function useBootstrap({
	refreshProfiles,
	setError,
	fallbackError,
}: UseBootstrapOptions) {
	const [loading, setLoading] = useState(true);
	const [failed, setFailed] = useState(false);
	const [attempt, setAttempt] = useState(0);
	const [config, setConfig] = useState<RemoteConfiguration | null>(null);
	const [news, setNews] = useState<NewsItem[]>([]);

	useEffect(() => {
		let cancelled = false;

		async function bootstrap() {
			setLoading(true);
			setError(null);
			setFailed(false);
			try {
				await waitForApi();
				const [remoteConfig] = await Promise.all([
					fetchRemoteConfiguration(),
					refreshProfiles(),
				]);
				const latestNews = await fetchNews();
				if (cancelled) return;
				setConfig(remoteConfig);
				setNews(latestNews);
			} catch (e) {
				if (cancelled) return;
				setError(e instanceof Error ? e.message : fallbackError);
				setFailed(true);
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		void bootstrap();
		return () => {
			cancelled = true;
		};
		// Volontairement cale sur `attempt` seul: le bouton Reessayer l'incremente,
		// et rejouer sur un changement de `refreshProfiles` relancerait tout le
		// demarrage a chaque rendu.
	}, [attempt]);

	return {
		loading,
		failed,
		config,
		news,
		retry: () => setAttempt((n) => n + 1),
	};
}

import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";

/**
 * La version du launcher, telle que Tauri la connait.
 *
 * <p>Elle vient de {@code tauri.conf.json}, seul endroit ou elle est vraie: la
 * reecrire dans le code aurait cree un deuxieme numero a tenir a jour, et c'est
 * exactement ce que {@code scripts/bump-version.mjs} existe pour eviter.
 *
 * <p>Hors de Tauri -- l'apercu dans un navigateur -- l'appel echoue et la
 * valeur reste « dev ». C'est plus honnete qu'un numero code en dur qui
 * afficherait une version qu'on ne tourne pas.
 */
export function useAppVersion(): string {
	const [version, setVersion] = useState("dev");

	useEffect(() => {
		getVersion()
			.then(setVersion)
			.catch(() => {
				// Pas de Tauri: « dev » est deja en place.
			});
	}, []);

	return version;
}

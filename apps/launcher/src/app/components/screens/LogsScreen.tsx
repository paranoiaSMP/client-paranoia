import { LogsTab } from "../tabs/LogsTab";
import { ScreenHeader } from "./ScreenHeader";

/**
 * Les journaux de lancement.
 *
 * <p>Absents de la maquette, qui n'ouvre aucune porte vers eux. Ils sont
 * pourtant la seule facon de savoir pourquoi un lancement a echoue -- le
 * message d'erreur de l'accueil tient en une ligne, la cause tient souvent
 * dans une trace Java de cinquante.
 */
export function LogsScreen() {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
			<ScreenHeader
				title="Journaux"
				subtitle="Sortie du service de lancement et du jeu."
			/>

			<div className="flex min-h-0 flex-1 flex-col">
				<LogsTab />
			</div>
		</div>
	);
}

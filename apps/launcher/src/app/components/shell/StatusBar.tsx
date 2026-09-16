import { Boxes, HardDrive } from "lucide-react";

type StatusBarProps = {
	/** Memoire maximale allouee au jeu, en megaoctets. Null avant chargement. */
	ramMaxMb: number | null;
	instanceCount: number;
	version: string;
};

/**
 * Le bandeau du bas: ce qui est vrai en permanence.
 *
 * <p>La maquette y placait aussi une latence -- « 28 ms · eu-west ». Cette
 * valeur vient d'un point d'entree du service local qui renvoie des constantes
 * ecrites en dur, dont ce 28: le chiffre de la maquette est litteralement
 * celui du code de test. Il n'est pas repris ici. Un bandeau d'etat qui affiche
 * une mesure inventee est pire qu'un bandeau qui n'en affiche aucune, parce
 * qu'on le croit.
 */
export function StatusBar({
	ramMaxMb,
	instanceCount,
	version,
}: StatusBarProps) {
	return (
		<div className="flex shrink-0 items-center justify-between gap-4 border-t border-divider bg-surface px-6 py-2 text-[12.5px] text-neutral-400">
			<div className="flex min-w-0 items-center gap-6">
				<span className="flex shrink-0 items-center gap-1.5">
					<HardDrive className="size-3.5" />
					RAM {ramMaxMb === null ? "—" : `${Math.round(ramMaxMb / 1024)} Go`}
				</span>
				<span className="flex shrink-0 items-center gap-1.5">
					<Boxes className="size-3.5" />
					{instanceCount} instance{instanceCount > 1 ? "s" : ""}
				</span>
			</div>
			<span className="shrink-0 truncate">© Paranoia Client — {version}</span>
		</div>
	);
}

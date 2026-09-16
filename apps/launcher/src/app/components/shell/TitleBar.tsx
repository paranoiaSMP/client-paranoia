import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

import { useAppVersion } from "../../hooks/useAppVersion";

/**
 * La barre de titre, dessinee par l'application.
 *
 * <p>La fenetre est passee en {@code decorations: false}: sans cela, la barre
 * du systeme se serait ajoutee au-dessus de celle-ci et l'ecran aurait porte
 * deux barres superposees.
 *
 * <p>Consequence directe: tout ce que la barre du systeme faisait gratuitement
 * doit etre refait ici. Le deplacement de la fenetre passe par
 * {@code data-tauri-drag-region}, et les trois boutons par l'API de fenetre --
 * avec les permissions correspondantes ajoutees dans
 * {@code capabilities/default.json}, faute de quoi les appels echouent en
 * silence.
 *
 * <p>Elle doit apparaitre sur <em>tous</em> les ecrans, y compris ceux d'avant
 * la connexion: sans decorations et sans elle, la fenetre ne peut etre ni
 * deplacee ni fermee, et un service local qui ne repond pas laisserait le
 * joueur devant un ecran d'erreur qu'il ne peut pas quitter.
 */
export function TitleBar() {
	const version = useAppVersion();
	const [maximized, setMaximized] = useState(false);

	// L'icone du bouton central doit dire ce qui va se passer, pas ce qui s'est
	// passe. L'etat peut changer sans passer par nous -- double-clic sur la
	// barre, raccourci du systeme, accrochage au bord de l'ecran -- donc on le
	// demande a la fenetre plutot que de le deduire de nos propres clics.
	useEffect(() => {
		const window = getCurrentWindow();
		let cancelled = false;

		const sync = () => {
			void window
				.isMaximized()
				.then((value) => {
					if (!cancelled) setMaximized(value);
				})
				.catch(() => {
					// Hors de Tauri -- l'apercu dans un navigateur -- il n'y a pas de
					// fenetre a interroger. L'etat par defaut suffit.
				});
		};

		sync();
		const unlisten = window.onResized(sync);
		return () => {
			cancelled = true;
			void unlisten.then((stop) => stop()).catch(() => {});
		};
	}, []);

	return (
		<div
			data-tauri-drag-region
			className="flex h-12 shrink-0 items-center justify-between border-b border-divider bg-gradient-to-b from-surface to-ground px-3"
		>
			<div
				data-tauri-drag-region
				className="flex min-w-0 items-center gap-3"
			>
				<span className="grid size-6 shrink-0 place-items-center rounded-sm bg-gradient-to-br from-accent-600 to-accent-500 text-[13px] font-bold text-accent-100">
					P
				</span>
				<span className="truncate text-xs uppercase tracking-[0.08em] text-neutral-400">
					launcher {version}
				</span>
			</div>

			<div className="flex shrink-0 items-center gap-1.5 text-neutral-300">
				<WindowButton
					label="Réduire"
					onClick={() => void getCurrentWindow().minimize()}
				>
					<Minus className="size-[15px]" />
				</WindowButton>
				<WindowButton
					label={maximized ? "Restaurer" : "Agrandir"}
					onClick={() => void getCurrentWindow().toggleMaximize()}
				>
					<Square className="size-[13px]" />
				</WindowButton>
				<WindowButton
					label="Fermer"
					danger
					onClick={() => void getCurrentWindow().close()}
				>
					<X className="size-[15px]" />
				</WindowButton>
			</div>
		</div>
	);
}

/**
 * Un bouton de fenetre.
 *
 * <p>La fermeture vire a l'accent au survol et non au rouge: le rouge est
 * reserve a l'arret d'un lancement en cours, qui interrompt quelque chose.
 * Fermer une fenetre n'interrompt rien.
 */
function WindowButton({
	label,
	danger,
	onClick,
	children,
}: {
	label: string;
	danger?: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			aria-label={label}
			title={label}
			type="button"
			onClick={onClick}
			className={`grid size-7 place-items-center rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
				danger
					? "hover:bg-accent-800 hover:text-accent-100"
					: "hover:bg-well hover:text-ink"
			}`}
		>
			{children}
		</button>
	);
}

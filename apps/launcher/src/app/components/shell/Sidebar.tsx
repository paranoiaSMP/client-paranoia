import type { MicrosoftAccount } from "@paranoia/contracts";

import { PRIMARY_NAV, SECONDARY_NAV } from "../../navigation";
import type { NavItem, Screen } from "../../navigation";

type SidebarProps = {
	current: Screen;
	onNavigate: (screen: Screen) => void;
	/** Null tant que le compte n'a pas ete demande pour l'instance courante. */
	modCount: number | null;
	account: MicrosoftAccount | null;
	/** Le service local repond: c'est lui qui installe et lance le jeu. */
	serviceReady: boolean;
};

/**
 * La barre laterale: la navigation, et qui joue.
 *
 * <p>Elle remplace le menu deroulant du coin, qui repliait cinq destinations
 * derriere un carre. Elles etaient toutes atteignables, mais aucune n'etait
 * visible: rien sur l'ecran ne disait qu'il existait des mods, des comptes ou
 * des parametres tant qu'on n'avait pas ouvert le carre.
 */
export function Sidebar({
	current,
	onNavigate,
	modCount,
	account,
	serviceReady,
}: SidebarProps) {
	return (
		<nav
			aria-label="Navigation principale"
			className="flex w-[252px] shrink-0 flex-col justify-between gap-4 border-r border-divider bg-surface px-3 py-4"
		>
			{/*
			  Le groupe du haut defile, le groupe du bas ne bouge pas.

			  Sans cela, `justify-between` poussait simplement le bas hors de la
			  fenetre des qu'elle etait courte: a 640 pixels de haut, la carte de
			  compte etait coupee en deux et le voyant du service disparaissait
			  entierement -- c'est-a-dire le seul endroit qui dit si le jeu peut se
			  lancer. Ce qui doit rester visible est ce qui ne peut pas defiler.
			*/}
			<div className="no-scrollbar flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto">
				<div className="px-2 pb-1 text-[11px] uppercase tracking-[0.14em] text-neutral-400">
					Client
				</div>
				{PRIMARY_NAV.map((item) => (
					<NavButton
						key={item.screen}
						item={item}
						active={current === item.screen}
						onClick={() => onNavigate(item.screen)}
						{...(item.screen === "mods" && modCount !== null
							? { count: modCount }
							: {})}
					/>
				))}
			</div>

			<div className="flex shrink-0 flex-col gap-1.5">
				{SECONDARY_NAV.map((item) => (
					<NavButton
						key={item.screen}
						item={item}
						active={current === item.screen}
						onClick={() => onNavigate(item.screen)}
					/>
				))}

				<button
					type="button"
					onClick={() => onNavigate("accounts")}
					className="elev-sm flex items-center gap-2 rounded-md bg-well p-2 text-left transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					<span className="size-[34px] shrink-0 overflow-hidden rounded-sm bg-gradient-to-br from-accent-700 to-accent-500">
						{account?.minecraftUsername && (
							<img
								alt=""
								className="size-full"
								src={`https://minotar.net/helm/${account.minecraftUsername}/68`}
							/>
						)}
					</span>
					<span className="flex min-w-0 flex-col">
						<span className="truncate text-sm font-medium">
							{account?.minecraftUsername ?? "Hors ligne"}
						</span>
						<span className="truncate text-xs text-neutral-400">
							{account ? "Microsoft · premium" : "Aucun compte"}
						</span>
					</span>
				</button>

				{/*
				  La maquette annonce ici « Services Mojang · OK ». Rien dans le
				  launcher n'interroge Mojang: l'afficher aurait ete un voyant toujours
				  vert, c'est-a-dire un voyant qui ne dit rien. Ce qui est affiche est
				  ce qu'on sait vraiment -- le service local repond ou non -- et c'est
				  precisement l'etat dont depend le lancement.
				*/}
				<div className="flex items-center gap-2 pl-2 text-xs text-neutral-400">
					<span
						className={`size-2 shrink-0 rounded-full ${
							serviceReady
								? "bg-accent-400 shadow-[0_0_10px_0_var(--color-accent)]"
								: "bg-danger"
						}`}
					/>
					{serviceReady ? "Service prêt" : "Service injoignable"}
				</div>
			</div>
		</nav>
	);
}

/**
 * Une entree de navigation.
 *
 * <p>L'etat actif est porte par une couche en position absolue plutot que par
 * les classes du bouton: le liseré de gauche et la lueur debordent du cadre, et
 * les poser sur le bouton lui-meme decalait son contenu de trois pixels a
 * chaque changement d'ecran.
 */
function NavButton({
	item,
	active,
	count,
	onClick,
}: {
	item: NavItem;
	active: boolean;
	count?: number;
	onClick: () => void;
}) {
	const Icon = item.icon;

	return (
		<button
			type="button"
			onClick={onClick}
			aria-current={active ? "page" : undefined}
			className={`relative flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-[15px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
				active ? "text-ink" : "text-neutral-200 hover:bg-well"
			}`}
		>
			{active && (
				<span aria-hidden className="nav-active pointer-events-none absolute inset-0 rounded-md" />
			)}
			<Icon
				className={`relative size-[21px] shrink-0 ${active ? "text-accent-300" : ""}`}
			/>
			<span className="relative flex-1 truncate">{item.label}</span>
			{item.upcoming && (
				<span className="relative shrink-0 rounded-sm border border-accent-700 px-1.5 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-accent-200">
					à venir
				</span>
			)}
			{count !== undefined && (
				<span className="relative shrink-0 text-[12.5px] text-accent-300">
					{count}
				</span>
			)}
		</button>
	);
}

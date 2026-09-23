import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, Users } from "lucide-react";
import type { MicrosoftAccount } from "@paranoia/contracts";

import { PRIMARY_NAV, SECONDARY_NAV } from "../../navigation";
import type { NavItem, Screen } from "../../navigation";

type SidebarProps = {
	current: Screen;
	onNavigate: (screen: Screen) => void;
	modCount: number | null;
	account: MicrosoftAccount | null;
	accounts?: MicrosoftAccount[];
	onSwitchAccount?: (account: MicrosoftAccount) => void;
	onAddAccount?: () => void;
};

export function Sidebar({
	current,
	onNavigate,
	modCount,
	account,
	accounts = [],
	onSwitchAccount,
	onAddAccount,
}: SidebarProps) {
	const [menuOpen, setMenuOpen] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!menuOpen) return;
		function handleClickOutside(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setMenuOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [menuOpen]);

	return (
		<nav
			aria-label="Navigation principale"
			className="flex w-[252px] shrink-0 flex-col justify-between gap-4 border-r border-divider bg-surface px-3 py-4"
		>
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

				<div ref={menuRef} className="relative">
					{menuOpen && (
						<div className="elev-md absolute bottom-full left-0 right-0 mb-2 flex flex-col gap-1 rounded-md border border-divider bg-surface p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
							<div className="flex items-center justify-between px-2 py-1 text-xs text-neutral-400 font-semibold">
								<span>Comptes</span>
								{accounts.length > 1 && (
									<span className="text-[11px] text-neutral-500 font-normal">
										{accounts.length}
									</span>
								)}
							</div>
							<div className="flex flex-col gap-1 max-h-48 overflow-y-auto no-scrollbar">
								{accounts.map((acc) => {
									const isCurrent = acc.id === account?.id;
									return (
										<button
											key={acc.id}
											type="button"
											onClick={() => {
												if (!isCurrent && onSwitchAccount) {
													onSwitchAccount(acc);
												}
												setMenuOpen(false);
											}}
											className={`flex items-center gap-2 rounded-md p-1.5 text-left transition-colors ${
												isCurrent
													? "bg-accent/15 text-accent-200 border border-accent/30"
													: "hover:bg-neutral-800 text-neutral-200 border border-transparent"
											}`}
										>
											<span className="size-6 shrink-0 overflow-hidden rounded-sm bg-neutral-700">
												<img
													alt=""
													className="size-full"
													src={`https://minotar.net/helm/${acc.minecraftUsername}/48`}
												/>
											</span>
											<span className="flex-1 min-w-0 truncate text-xs font-medium">
												{acc.minecraftUsername}
											</span>
											{isCurrent && (
												<Check className="size-3.5 shrink-0 text-accent" />
											)}
										</button>
									);
								})}
							</div>
							<div className="my-1 border-t border-divider" />
							{onAddAccount && (
								<button
									type="button"
									onClick={() => {
										setMenuOpen(false);
										onAddAccount();
									}}
									className="flex items-center gap-2 rounded-md p-1.5 text-left text-xs font-medium text-neutral-300 hover:bg-neutral-800 hover:text-ink transition-colors"
								>
									<Plus className="size-3.5 text-accent-300" />
									<span>Ajouter un compte</span>
								</button>
							)}
							<button
								type="button"
								onClick={() => {
									setMenuOpen(false);
									onNavigate("accounts");
								}}
								className="flex items-center gap-2 rounded-md p-1.5 text-left text-xs font-medium text-neutral-400 hover:bg-neutral-800 hover:text-ink transition-colors"
							>
								<Users className="size-3.5" />
								<span>Gérer les comptes</span>
							</button>
						</div>
					)}

					<button
						type="button"
						onClick={() => setMenuOpen((prev) => !prev)}
						className="elev-sm flex w-full items-center gap-2 rounded-md bg-well p-2 text-left transition-colors hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
						<span className="flex min-w-0 flex-1 flex-col">
							<span className="truncate text-sm font-medium">
								{account?.minecraftUsername ?? "Hors ligne"}
							</span>
							<span className="truncate text-xs text-neutral-400">
								{account ? "Compte Microsoft" : "Aucun compte"}
							</span>
						</span>
						<ChevronsUpDown className="size-4 shrink-0 text-neutral-400" />
					</button>
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
			{/* Sans interlettrage et sans capitales: « Cosmétiques » plus « À VENIR »
			    espace ne tenaient pas ensemble dans les 252 pixels de la colonne, et
			    c'est le nom de la destination qui se faisait couper -- l'etiquette
			    mangeait ce qu'elle qualifie. */}
			{item.upcoming && (
				<span className="relative shrink-0 rounded-sm border border-neutral-700 bg-neutral-800/30 px-1.5 py-px text-[10px] font-medium text-neutral-400">
					à venir
				</span>
			)}
			{count !== undefined && (
				<span className="relative shrink-0 text-[12.5px] text-neutral-300">
					{count}
				</span>
			)}
		</button>
	);
}

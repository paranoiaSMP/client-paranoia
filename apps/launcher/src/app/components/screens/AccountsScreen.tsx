import { Plus } from "lucide-react";
import type { MicrosoftAccount } from "@paranoia/contracts";

import { ScreenHeader } from "./ScreenHeader";

type AccountsScreenProps = {
	account: MicrosoftAccount | null;
	accounts: MicrosoftAccount[];
	connecting: boolean;
	onConnect: () => void;
	onSwitch: (account: MicrosoftAccount) => void;
};

/**
 * Les comptes Microsoft enregistres.
 *
 * <p>Le compte actif porte un liseré accentue et une lueur, les autres une
 * simple invitation a les activer. C'est la meme grammaire que la barre
 * laterale: ce qui est choisi s'eclaire, ce qui ne l'est pas reste sobre.
 */
export function AccountsScreen({
	account,
	accounts,
	connecting,
	onConnect,
	onSwitch,
}: AccountsScreenProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
			<ScreenHeader
				title="Comptes"
				subtitle="Un seul compte peut être actif à la fois."
			/>

			{accounts.length === 0 ? (
				<p className="m-0 text-sm text-neutral-400">
					Aucun compte enregistré.
				</p>
			) : (
				<div className="grid max-w-[780px] grid-cols-[repeat(auto-fit,minmax(270px,1fr))] gap-4">
					{accounts.map((entry) => {
						const active = entry.id === account?.id;
						return (
							<button
								key={entry.id}
								type="button"
								disabled={active}
								onClick={() => onSwitch(entry)}
								className={`flex items-center gap-3 rounded-md bg-surface p-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
									active
										? "border-2 border-accent-700 shadow-[0_0_22px_-10px_var(--color-accent)]"
										: "border-2 border-transparent hover:bg-well"
								}`}
							>
								<span className="size-12 shrink-0 overflow-hidden rounded-sm bg-gradient-to-br from-accent-700 to-accent-500">
									<img
										alt=""
										className="size-full"
										src={`https://minotar.net/helm/${entry.minecraftUsername}/96`}
									/>
								</span>
								<span className="flex min-w-0 flex-1 flex-col gap-px">
									<span className="truncate text-[15px] font-medium">
										{entry.minecraftUsername}
									</span>
									<span className="truncate text-[12.5px] text-neutral-400">
										Compte Microsoft
									</span>
								</span>
								<span className="shrink-0 whitespace-nowrap text-[13px]">
									{active ? (
										<span className="rounded-[6px] bg-accent-800 px-2.5 py-0.5 text-[12px] text-accent-100">
											Actif
										</span>
									) : (
										<span className="text-accent-300">Activer</span>
									)}
								</span>
							</button>
						);
					})}
				</div>
			)}

			<button
				type="button"
				onClick={onConnect}
				disabled={connecting}
				className="flex items-center gap-1.5 self-start whitespace-nowrap rounded-md border border-divider px-3 py-2 text-[13.5px] font-medium transition-colors hover:border-accent-700 hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
			>
				<Plus className="size-3.5" />
				{connecting ? "Connexion…" : "Ajouter un compte"}
			</button>
		</div>
	);
}

import { Plus, Trash2 } from "lucide-react";
import type { MicrosoftAccount } from "@paranoia/contracts";

import { ScreenHeader } from "./ScreenHeader";

type AccountsScreenProps = {
	account: MicrosoftAccount | null;
	accounts: MicrosoftAccount[];
	connecting: boolean;
	onConnect: () => void;
	onSwitch: (account: MicrosoftAccount) => void;
	onDeleteAccount?: (id: string) => void;
};

export function AccountsScreen({
	account,
	accounts,
	connecting,
	onConnect,
	onSwitch,
	onDeleteAccount,
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
							<div
								key={entry.id}
								className={`flex items-center gap-2 rounded-md bg-surface p-3 transition-colors ${
									active
										? "border-2 border-accent-700 shadow-[0_0_22px_-10px_var(--color-accent)]"
										: "border-2 border-transparent hover:bg-well"
								}`}
							>
								<button
									type="button"
									disabled={active}
									onClick={() => onSwitch(entry)}
									className="flex flex-1 items-center gap-3 text-left focus-visible:outline-none disabled:cursor-default"
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
								{onDeleteAccount && (
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											onDeleteAccount(entry.id);
										}}
										className="shrink-0 p-1.5 text-neutral-500 hover:text-danger hover:bg-danger/10 rounded transition-colors"
										title="Supprimer ce compte"
									>
										<Trash2 className="size-4" />
									</button>
								)}
							</div>
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

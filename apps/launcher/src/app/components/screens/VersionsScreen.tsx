import { Box, MoreHorizontal, Plus, Star, Upload } from "lucide-react";
import type { LauncherProfile } from "@paranoia/contracts";

type VersionsScreenProps = {
	profiles: LauncherProfile[];
	selectedId: string | null;
	onSelect: (profileId: string) => void;
	onOpenInstance: (profileId: string) => void;
	onCreate: () => void;
	onMigrate: () => void;
};

/**
 * Les instances installees.
 *
 * <p>La maquette affiche une taille sur disque par instance. Le launcher ne la
 * connait pas: aucun champ du profil ne la porte et rien ne mesure le dossier.
 * La colonne montre donc la memoire allouee et le mode graphique, qui sont
 * reellement enregistres -- plutot qu'un poids plausible que personne n'aurait
 * verifie.
 */
export function VersionsScreen({
	profiles,
	selectedId,
	onSelect,
	onOpenInstance,
	onCreate,
	onMigrate,
}: VersionsScreenProps) {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
			<header className="flex flex-col gap-1.5">
				<h1 className="m-0 text-[26px] font-medium tracking-[-0.01em]">
					Versions
				</h1>
				<p className="m-0 text-sm text-neutral-300">
					Instances installées sur cette machine.
				</p>
			</header>

			{profiles.length === 0 ? (
				<p className="m-0 text-sm text-neutral-400">
					Aucune instance. Crée la première pour pouvoir lancer le jeu.
				</p>
			) : (
				<div className="flex flex-col">
					{profiles.map((profile) => {
						const active = profile.id === selectedId;
						return (
							<div
								key={profile.id}
								className="flex items-center gap-4 border-b border-divider transition-colors hover:bg-well"
							>
								<button
									type="button"
									onClick={() => onSelect(profile.id)}
									className="flex min-w-0 flex-1 items-center gap-4 px-3 py-4 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
								>
									<span className="grid size-9 shrink-0 place-items-center rounded-sm bg-well text-accent-300">
										<Box className="size-[18px]" />
									</span>
									<span className="flex min-w-0 flex-1 flex-col gap-px">
										<span className="flex items-center gap-2 truncate text-[14.5px] font-medium">
											{profile.name}
											{profile.favorite && (
												<Star className="size-3.5 shrink-0 fill-accent-300 text-accent-300" />
											)}
										</span>
										<span className="truncate text-[12.5px] text-neutral-400">
											{profile.profileTypeId} · {profile.minecraftVersion}
										</span>
									</span>
									<span className="hidden shrink-0 text-[12.5px] text-neutral-400 sm:block">
										{Math.round(profile.ramMb / 1024)} Go ·{" "}
										{profile.graphicsModeId}
									</span>
									<span className="shrink-0 whitespace-nowrap text-[13px]">
										{active ? (
											<span className="rounded-[6px] bg-accent-800 px-2.5 py-0.5 text-[12px] text-accent-100">
												Active
											</span>
										) : (
											<span className="text-accent-300">Sélectionner</span>
										)}
									</span>
								</button>

								<button
									type="button"
									aria-label={`Options de ${profile.name}`}
									onClick={() => onOpenInstance(profile.id)}
									className="mr-2 grid size-8 shrink-0 place-items-center rounded-sm text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								>
									<MoreHorizontal className="size-4" />
								</button>
							</div>
						);
					})}
				</div>
			)}

			<div className="flex flex-wrap gap-3">
				<button
					type="button"
					onClick={onCreate}
					className="flex items-center gap-1.5 self-start whitespace-nowrap rounded-md border border-divider px-3 py-2 text-[13.5px] font-medium transition-colors hover:border-accent-700 hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					<Plus className="size-3.5" />
					Nouvelle instance
				</button>

				{/* La migration depuis les autres launchers n'apparait pas dans la
				    maquette. Elle reste ici: c'est la seule porte vers les huit
				    launchers concurrents que le backend sait lire, et la retirer
				    aurait supprime une fonction entiere pour respecter un dessin. */}
				<button
					type="button"
					onClick={onMigrate}
					className="flex items-center gap-1.5 self-start whitespace-nowrap rounded-md border border-divider px-3 py-2 text-[13.5px] font-medium transition-colors hover:border-accent-700 hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					<Upload className="size-3.5" />
					Importer depuis un autre launcher
				</button>
			</div>
		</div>
	);
}

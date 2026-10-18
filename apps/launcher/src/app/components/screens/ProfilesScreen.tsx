import { motion } from "motion/react";
import { ArrowUpRight, Box, FolderInput, Loader2, Package, Play, Plus, Star } from "lucide-react";
import type { LauncherProfile } from "@paranoia/contracts";

import { useModCounts } from "../../hooks/useModCounts";
import { lastPlayedLabel, loaderLabel } from "../../lib/profileFormat";
import { ScreenHeader } from "./ScreenHeader";

type ProfilesScreenProps = {
	profiles: LauncherProfile[];
	/** L'instance courante: celle que le bouton Jouer de l'accueil lancerait. */
	activeId: string | null;
	running: boolean;
	onOpen: (profileId: string) => void;
	onPlay: (profile: LauncherProfile) => void;
	onCreate: () => void;
	onImport: () => void;
	onBrowseModpacks: () => void;
};

const SPRING = { type: "spring", stiffness: 140, damping: 22 } as const;

/**
 * Les instances installees.
 *
 * <p>L'instance courante passe devant, en grand: c'est celle qu'on lance dans
 * neuf cas sur dix, et la noyer dans une liste egale n'aidait personne. Les
 * autres suivent en lignes, sans cadre -- le trait qui les separe suffit.
 *
 * <p>La taille sur disque que montrait la maquette n'existe pas: aucun champ du
 * profil ne la porte. Les colonnes montrent ce qui est reellement enregistre.
 */
export function ProfilesScreen({
	profiles,
	activeId,
	running,
	onOpen,
	onPlay,
	onCreate,
	onImport,
	onBrowseModpacks,
}: ProfilesScreenProps) {
	const counts = useModCounts(profiles);
	const active = profiles.find((p) => p.id === activeId) ?? profiles[0] ?? null;
	const others = profiles.filter((p) => p.id !== active?.id);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-8 overflow-auto p-6">
			<ScreenHeader
				title="Profils"
				subtitle={
					profiles.length === 0
						? "Aucune instance pour le moment."
						: `${profiles.length} instance${profiles.length > 1 ? "s" : ""} sur cette machine, la dernière jouée en premier.`
				}
			/>

			<div className="grid min-h-0 grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
				<div className="flex min-w-0 flex-col gap-8">
					{active ? (
						<ActiveProfile
							profile={active}
							modCount={counts[active.id]}
							running={running}
							onOpen={() => onOpen(active.id)}
							onPlay={() => onPlay(active)}
						/>
					) : (
						<EmptyProfiles />
					)}

					{others.length > 0 && (
						<section aria-label="Autres instances">
							<h2 className="m-0 mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
								Autres instances
							</h2>
							<ul className="m-0 flex list-none flex-col divide-y divide-divider border-y border-divider p-0">
								{others.map((profile, index) => (
									<motion.li
										key={profile.id}
										layout
										initial={{ opacity: 0, y: 6 }}
										animate={{ opacity: 1, y: 0 }}
										transition={{ ...SPRING, delay: index * 0.04 }}
									>
										<ProfileRow
											profile={profile}
											modCount={counts[profile.id]}
											onOpen={() => onOpen(profile.id)}
											onPlay={() => onPlay(profile)}
											disabled={running}
										/>
									</motion.li>
								))}
							</ul>
						</section>
					)}
				</div>

				<aside aria-label="Ajouter une instance" className="flex flex-col lg:sticky lg:top-0 lg:self-start">
					<h2 className="m-0 mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
						Ajouter une instance
					</h2>
					<div className="flex flex-col divide-y divide-divider border-y border-divider">
						<AddAction
							icon={<Plus className="size-4" />}
							title="Partir de zéro"
							text="Choisis une version de Minecraft et un loader."
							onClick={onCreate}
						/>
						<AddAction
							icon={<Package className="size-4" />}
							title="Un modpack Modrinth"
							text="Installe un pack complet, mods compris."
							onClick={onBrowseModpacks}
						/>
						<AddAction
							icon={<FolderInput className="size-4" />}
							title="Un autre launcher"
							text="Reprends tes instances de Prism, Lunar, CurseForge et d'autres."
							onClick={onImport}
						/>
					</div>
				</aside>
			</div>
		</div>
	);
}

function ActiveProfile({
	profile,
	modCount,
	running,
	onOpen,
	onPlay,
}: {
	profile: LauncherProfile;
	modCount: number | null | undefined;
	running: boolean;
	onOpen: () => void;
	onPlay: () => void;
}) {
	return (
		<section
			aria-label="Instance courante"
			className="grid grid-cols-1 gap-6 border-b border-divider pb-8 md:grid-cols-[auto_minmax(0,1fr)] md:gap-8"
		>
			{/* Le numero de version est la signature de l'ecran: grand, en chasse
			    fixe, il dit en un coup d'oeil de quelle instance on parle. */}
			<div className="flex flex-col justify-between gap-2">
				<span className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
					Instance courante
				</span>
				<span className="font-mono text-[56px] font-medium leading-none tracking-tighter tabular-nums text-ink md:text-[72px]">
					{profile.minecraftVersion}
				</span>
			</div>

			<div className="flex min-w-0 flex-col justify-end gap-5">
				<div className="flex min-w-0 flex-col gap-1.5">
					<h2 className="m-0 flex items-center gap-2 truncate text-[22px] font-medium">
						{profile.name}
						{profile.favorite && (
							<Star aria-label="Favori" className="size-4 shrink-0 fill-accent-300 text-accent-300" />
						)}
					</h2>
					<p className="m-0 text-[13px] text-neutral-400">
						{loaderLabel(profile.profileTypeId)} · {lastPlayedLabel(profile).toLowerCase()}
					</p>
				</div>

				<dl className="m-0 flex flex-wrap gap-x-8 gap-y-3">
					<Stat label="Mods" value={modCount === undefined ? "" : modCount === null ? "--" : String(modCount)} loading={modCount === undefined} />
					<Stat label="Mémoire" value={`${Math.round(profile.ramMb / 1024)} Go`} />
					<Stat label="Graphismes" value={profile.graphicsModeId} />
					<Stat label="Résolution" value={profile.resolution} />
				</dl>

				<div className="flex flex-wrap gap-3">
					<button
						type="button"
						onClick={onPlay}
						disabled={running}
						className="flex items-center gap-2 rounded-md bg-accent-700 px-5 py-2.5 text-[14px] font-medium text-accent-100 transition-[background-color,transform] hover:bg-accent-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					>
						{running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
						{running ? "En cours" : "Jouer"}
					</button>
					<button
						type="button"
						onClick={onOpen}
						className="flex items-center gap-2 rounded-md border border-divider px-4 py-2.5 text-[14px] font-medium transition-colors hover:border-accent-700 hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					>
						Ouvrir la fiche
						<ArrowUpRight className="size-4 text-neutral-400" />
					</button>
				</div>
			</div>
		</section>
	);
}

function Stat({ label, value, loading }: { label: string; value: string; loading?: boolean }) {
	return (
		<div className="flex flex-col gap-0.5">
			<dt className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">{label}</dt>
			<dd className="m-0 font-mono text-[14px] tabular-nums capitalize text-ink">
				{loading ? <span aria-label="Chargement" className="block h-[18px] w-8 animate-pulse rounded-sm bg-well" /> : value}
			</dd>
		</div>
	);
}

function ProfileRow({
	profile,
	modCount,
	onOpen,
	onPlay,
	disabled,
}: {
	profile: LauncherProfile;
	modCount: number | null | undefined;
	onOpen: () => void;
	onPlay: () => void;
	disabled: boolean;
}) {
	return (
		<div className="group flex items-center gap-2 transition-colors hover:bg-well">
			<button
				type="button"
				onClick={onOpen}
				className="flex min-w-0 flex-1 items-center gap-4 px-3 py-3.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
			>
				<span className="grid size-10 shrink-0 place-items-center rounded-sm bg-well text-neutral-300 group-hover:bg-surface">
					<Box className="size-[18px]" />
				</span>
				<span className="flex min-w-0 flex-1 flex-col gap-px">
					<span className="flex items-center gap-2 truncate text-[14.5px] font-medium">
						{profile.name}
						{profile.favorite && <Star aria-label="Favori" className="size-3.5 shrink-0 fill-accent-300 text-accent-300" />}
					</span>
					<span className="truncate text-[12.5px] text-neutral-400">
						<span className="font-mono tabular-nums">{profile.minecraftVersion}</span> · {loaderLabel(profile.profileTypeId)} · {lastPlayedLabel(profile).toLowerCase()}
					</span>
				</span>
				<span className="hidden shrink-0 font-mono text-[12.5px] tabular-nums text-neutral-400 sm:block">
					{modCount === undefined ? "" : modCount === null ? "--" : `${modCount} mod${modCount > 1 ? "s" : ""}`}
				</span>
			</button>

			<button
				type="button"
				aria-label={`Lancer ${profile.name}`}
				onClick={onPlay}
				disabled={disabled}
				className="mr-2 grid size-9 shrink-0 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-accent-700 hover:text-accent-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
			>
				<Play className="size-4 fill-current" />
			</button>
		</div>
	);
}

function AddAction({
	icon,
	title,
	text,
	onClick,
}: {
	icon: React.ReactNode;
	title: string;
	text: string;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="flex items-start gap-3 px-1 py-4 text-left transition-colors hover:bg-well focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
		>
			<span className="mt-0.5 text-neutral-300">{icon}</span>
			<span className="flex flex-col gap-0.5">
				<span className="text-[14px] font-medium">{title}</span>
				<span className="text-[12.5px] leading-snug text-neutral-400">{text}</span>
			</span>
		</button>
	);
}

function EmptyProfiles() {
	return (
		<section className="flex flex-col gap-2 border-b border-divider pb-8">
			<h2 className="m-0 text-[22px] font-medium">Aucune instance</h2>
			<p className="m-0 max-w-[48ch] text-[14px] leading-relaxed text-neutral-300">
				Une instance est un dossier de jeu avec sa version, ses mods et ses options. Crée la première, installe un modpack ou reprends une instance d'un autre launcher : le choix est à droite.
			</p>
		</section>
	);
}

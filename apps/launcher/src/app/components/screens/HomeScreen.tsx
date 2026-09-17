import { useState } from "react";
import { ChevronDown, Layers, Play, X } from "lucide-react";
import type {
	LauncherProfile,
	MicrosoftAccount,
	NewsItem,
} from "@paranoia/contracts";

import { SkinViewer3D } from "../../../components/SkinViewer3D";
import type { LaunchStatusResponse } from "../../../shared/api/launcherClient";

type HomeScreenProps = {
	profile: LauncherProfile | null;
	modCount: number | null;
	account: MicrosoftAccount | null;
	lobbyCape: string | undefined;
	running: boolean;
	status: LaunchStatusResponse;
	news: NewsItem[];
	onPlay: () => void;
	onStop: () => void;
	onGoVersions: () => void;
	onGoCosmetics: () => void;
};

/**
 * Les libelles de l'etat de lancement.
 *
 * <p>Le backend envoie deja un texte, et c'est lui qui s'affiche des qu'il en
 * a un. Cette table ne couvre que le cas ou il n'a encore rien dit: sans elle,
 * la ligne restait vide entre le clic et la premiere reponse, ce qui donnait
 * l'impression que le clic n'avait rien declenche.
 */
const FALLBACK_STATUS: Record<LaunchStatusResponse["state"], string> = {
	idle: "Prêt",
	downloading_java: "Installation de Java…",
	downloading_assets: "Téléchargement des ressources…",
	launching: "Démarrage du jeu…",
	running: "Minecraft en cours d'exécution",
	error: "Le lancement a échoué",
};

/**
 * L'accueil: l'instance courante, son lancement, et les actualites.
 *
 * <p>Il ne porte plus la navigation. Les raccourcis qui s'entassaient autour du
 * bouton de lancement -- mods, journaux, dossier, instances -- sont passes dans
 * la barre laterale, ou ils sont visibles en permanence au lieu d'etre replies
 * derriere un carre.
 */
export function HomeScreen({
	profile,
	modCount,
	account,
	lobbyCape,
	running,
	status,
	news,
	onPlay,
	onStop,
	onGoVersions,
	onGoCosmetics,
}: HomeScreenProps) {
	const [newsExpanded, setNewsExpanded] = useState(true);
	// La progression arrive de 0 a 100. L'ancien accueil la multipliait encore
	// par cent avant de la poser en largeur: la barre passait a fond des le
	// premier pourcent, et le debordement etant masque, elle avait l'air de
	// fonctionner.
	const progress = running ? Math.min(100, Math.max(0, status.progress)) : 0;
	const statusText = status.text.trim() || FALLBACK_STATUS[status.state];

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-auto">
			<section className="relative flex shrink-0 flex-wrap items-start justify-between gap-6 border-b border-divider bg-gradient-to-b from-surface to-ground p-6">
				<div className="flex min-w-[300px] max-w-[620px] flex-1 flex-col gap-4">
					<span className="text-xs uppercase tracking-[0.16em] text-accent-300">
						Profil
					</span>

					<div className="flex flex-col gap-1.5">
						<h1 className="m-0 text-[42px] font-semibold leading-[1.05] tracking-[-0.03em]">
							{profile ? profile.name : "Aucune instance"}
						</h1>
						<p className="m-0 text-[15px] text-neutral-300">
							{profile
								? [
										profile.profileTypeId,
										`Minecraft ${profile.minecraftVersion}`,
										modCount !== null ? `${modCount} mods actifs` : null,
									]
										.filter(Boolean)
										.join(" · ")
								: "Crée une instance pour commencer à jouer."}
						</p>
					</div>

					<div className="flex flex-wrap items-center gap-6">
						<button
							type="button"
							disabled={!profile}
							onClick={running ? onStop : onPlay}
							className={`flex items-center gap-2 whitespace-nowrap rounded-md border-2 px-7 py-3.5 text-base font-semibold tracking-[0.04em] transition-[filter,background-color] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
								running
									? "border-danger text-danger focus-visible:outline-danger"
									: "border-accent text-accent shadow-[0_0_14px_-4px_var(--color-accent),inset_0_0_0_1px_var(--color-accent-700)] focus-visible:outline-accent"
							}`}
						>
							{running ? (
								<>
									<X className="size-4" />
									ARRÊTER
								</>
							) : (
								<>
									<Play className="size-4 fill-current" />
									JOUER
								</>
							)}
						</button>

						<button
							type="button"
							onClick={onGoVersions}
							className="flex items-center gap-2 whitespace-nowrap rounded-md border-2 border-divider bg-surface px-3 py-2.5 text-left transition-colors hover:border-accent-700 hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						>
							<Layers className="size-[17px] text-accent-300" />
							<span className="flex flex-col gap-px leading-tight">
								<span className="text-[10.5px] uppercase tracking-[0.1em] text-neutral-400">
									Version
								</span>
								<span className="text-sm font-semibold">
									{profile ? profile.minecraftVersion : "—"}
								</span>
							</span>
							<ChevronDown className="size-3.5 text-neutral-400" />
						</button>
					</div>

					<div className="flex max-w-[440px] flex-col gap-1.5">
						<div className="flex items-baseline justify-between gap-3 text-[13px] leading-snug text-neutral-300">
							<span className="min-w-0 truncate">{statusText}</span>
							{running && status.state !== "running" && (
								<span className="whitespace-nowrap">{progress} %</span>
							)}
						</div>
						{running && status.state !== "running" && (
							<div className="h-1.5 overflow-hidden rounded-[3px] bg-well shadow-[inset_0_0_0_1px_var(--color-divider)]">
								<div
									className="h-full bg-gradient-to-r from-accent-600 to-accent-300 shadow-[0_0_14px_0_var(--color-accent)] transition-[width] duration-200"
									style={{ width: `${progress}%` }}
								/>
							</div>
						)}
					</div>
				</div>

				<div className="elev-md flex w-[248px] shrink-0 flex-col gap-3 rounded-lg bg-surface p-4">
					<div className="flex items-center justify-between gap-2 text-xs font-medium uppercase tracking-[0.12em] text-neutral-400">
						<span>Skin</span>
						<span className="truncate normal-case tracking-normal text-accent-300">
							{account?.minecraftUsername ?? "Steve"}
						</span>
					</div>

					{/*
					  L'embleme flouté deborde volontairement du cadre: il est pose
					  avant le conteneur qui rogne, pas dedans. C'est ce debordement
					  qui fait la lueur a gauche du panneau -- range a l'interieur, il
					  se reduirait a une tache grise derriere le personnage.

					  `mix-blend-mode: lighten` plutot qu'une opacite seule: sur un fond
					  sombre, il n'ajoute que ce qui est plus clair que lui, donc il
					  eclaire sans salir les noirs.
					*/}
					<div className="relative h-[220px] rounded-md bg-ground shadow-[inset_0_0_0_2px_var(--color-divider)]">
						<img
							alt=""
							aria-hidden
							draggable={false}
							src="/assets/paranoia-emblem.png"
							className="pointer-events-none absolute left-0 top-1/2 w-[300px] max-w-none -translate-x-[62%] -translate-y-[54%] opacity-25 mix-blend-lighten blur-[7px]"
						/>
						<div className="absolute inset-0 overflow-hidden rounded-md">
							<SkinViewer3D
								className="size-full"
								zoom={0.62}
								skinUrl={`https://minotar.net/skin/${account?.minecraftUsername ?? "Steve"}`}
								{...(lobbyCape ? { capeUrl: lobbyCape } : {})}
								paused={running}
							/>
						</div>
					</div>

					<p className="m-0 text-center text-xs text-neutral-400">
						Glisser un skin .png
					</p>

					<button
						type="button"
						onClick={onGoCosmetics}
						className="flex items-center justify-center whitespace-nowrap rounded-md border-2 border-divider py-2 text-sm font-semibold transition-colors hover:border-accent-700 hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					>
						Changer de skin
					</button>
				</div>
			</section>

			<section
				className={`flex flex-col transition-all ${
					newsExpanded ? "gap-4 p-6" : "gap-0 px-6 py-3.5"
				}`}
			>
				<div className="flex items-center justify-between">
					<h2 className="m-0 text-[17px] font-medium">Actualités du client</h2>
					<button
						type="button"
						onClick={() => setNewsExpanded((prev) => !prev)}
						aria-expanded={newsExpanded}
						className="flex items-center gap-1.5 text-xs text-neutral-400 hover:text-neutral-200 transition-colors"
					>
						<span>{newsExpanded ? "Réduire" : "Afficher"}</span>
						<ChevronDown
							className={`size-4 transition-transform duration-200 ${
								newsExpanded ? "" : "-rotate-90"
							}`}
						/>
					</button>
				</div>

				{newsExpanded && (
					news.length === 0 ? (
						<p className="m-0 text-sm text-neutral-400">
							Aucune actualité pour le moment.
						</p>
					) : (
						<div className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
							{news.slice(0, 3).map((item) => (
								<NewsCard key={item.id} item={item} />
							))}
						</div>
					)
				)}
			</section>
		</div>
	);
}

function NewsCard({ item }: { item: NewsItem }) {
	// `publishedAt` est une date ISO. Elle s'affichait telle quelle par endroits,
	// ce qui donnait « 2026-09-14T00:00:00.000Z » dans une carte de trois lignes.
	const date = new Date(item.publishedAt);
	const label = Number.isNaN(date.getTime())
		? item.publishedAt
		: date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

	return (
		<article className="flex flex-col overflow-hidden rounded-md bg-surface">
			<div className="h-[120px] bg-gradient-to-br from-accent-900 to-neutral-900">
				{item.imageUrl && (
					<img alt="" className="size-full object-cover" src={item.imageUrl} />
				)}
			</div>
			<div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
				{item.tags[0] && (
					<span className="self-start rounded-[6px] bg-accent-800 px-2.5 py-0.5 text-[11px] text-accent-100">
						{item.tags[0]}
					</span>
				)}
				<h3 className="m-0 text-[15.5px] font-medium leading-tight">
					{item.title}
				</h3>
				<p className="m-0 flex-1 text-[13.5px] text-neutral-300">
					{item.excerpt}
				</p>
				<span className="text-[12.5px] text-neutral-400">{label}</span>
			</div>
		</article>
	);
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, Loader2, Package, Play, Plus, RefreshCw, Search, Settings, Star, Trash2 } from "lucide-react";
import type { LauncherProfile, RemoteConfiguration } from "@paranoia/contracts";

import {
	listInstalledMods,
	removeMod,
	toggleMod,
	type ContentType,
	type InstalledMod,
} from "../../../shared/api/modsClient";
import { formatBytes, lastPlayedLabel, loaderLabel } from "../../lib/profileFormat";
import { InstanceSettings } from "../InstanceSettings";

type ProfileScreenProps = {
	profile: LauncherProfile;
	config: RemoteConfiguration | null;
	running: boolean;
	onBack: () => void;
	onPlay: () => void;
	onFavorite: () => void;
	onDelete: () => Promise<unknown>;
	onRefresh: () => Promise<unknown>;
	/** Ouvre le catalogue sur ce type de contenu, pour cette instance. */
	onBrowse: (kind: ContentType) => void;
};

const TABS: { kind: ContentType; label: string; empty: string; noun: string }[] = [
	{ kind: "mod", label: "Mods", noun: "mod", empty: "Aucun mod sur cette instance." },
	{ kind: "shader", label: "Shaders", noun: "shader", empty: "Aucun shader sur cette instance." },
	{ kind: "resourcepack", label: "Packs de ressources", noun: "pack", empty: "Aucun pack de ressources sur cette instance." },
	{ kind: "datapack", label: "Datapacks", noun: "datapack", empty: "Aucun datapack sur cette instance." },
];

type Content = Record<ContentType, InstalledMod[]>;
const EMPTY: Content = { mod: [], shader: [], resourcepack: [], datapack: [] };

/**
 * La fiche d'une instance: ce qu'elle contient, et ce qu'on peut en faire.
 *
 * <p>Ouvrir un profil montre ses mods, pas un menu: c'est la question qu'on se
 * pose en cliquant dessus. Les reglages (nom, version, memoire, touches)
 * attendent derriere la molette en haut a droite et n'occupent pas la page.
 */
export function ProfileScreen({
	profile,
	config,
	running,
	onBack,
	onPlay,
	onFavorite,
	onDelete,
	onRefresh,
	onBrowse,
}: ProfileScreenProps) {
	const [tab, setTab] = useState<ContentType>("mod");
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [content, setContent] = useState<Content>(EMPTY);
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
	const [errorText, setErrorText] = useState("");
	const [query, setQuery] = useState("");

	const load = useCallback(async () => {
		setStatus("loading");
		try {
			const [mod, shader, resourcepack, datapack] = await Promise.all(
				TABS.map((t) => listInstalledMods(profile.id, t.kind)),
			);
			setContent({ mod: mod ?? [], shader: shader ?? [], resourcepack: resourcepack ?? [], datapack: datapack ?? [] });
			setStatus("ready");
		} catch (err) {
			setErrorText(err instanceof Error ? err.message : "Lecture du contenu impossible");
			setStatus("error");
		}
	}, [profile.id]);

	useEffect(() => {
		setQuery("");
		void load();
	}, [load]);

	const current = TABS.find((t) => t.kind === tab) ?? TABS[0]!;
	const visible = useMemo(() => {
		const q = query.trim().toLowerCase();
		const items = content[tab];
		const filtered = q
			? items.filter((m) => (m.name ?? m.fileName).toLowerCase().includes(q) || m.fileName.toLowerCase().includes(q))
			: items;
		return [...filtered].sort((a, b) => (a.name ?? a.fileName).localeCompare(b.name ?? b.fileName, "fr"));
	}, [content, tab, query]);

	function replace(kind: ContentType, next: (items: InstalledMod[]) => InstalledMod[]) {
		setContent((c) => ({ ...c, [kind]: next(c[kind]) }));
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col overflow-auto">
			<div className="flex items-center justify-between gap-3 px-6 pt-5">
				<button
					type="button"
					onClick={onBack}
					className="-ml-2 flex items-center gap-2 rounded-md px-2 py-1.5 text-[13.5px] text-neutral-300 transition-colors hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					<ArrowLeft className="size-4" />
					Profils
				</button>

				<button
					type="button"
					aria-label="Réglages de l'instance"
					aria-haspopup="dialog"
					aria-expanded={settingsOpen}
					onClick={() => setSettingsOpen(true)}
					className="group grid size-10 place-items-center rounded-md text-neutral-300 transition-colors hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					<Settings className="size-[22px] transition-transform duration-500 ease-out group-hover:rotate-90" />
				</button>
			</div>

			<header className="grid grid-cols-1 gap-6 border-b border-divider px-6 pb-7 pt-4 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-end md:gap-8">
				<span className="font-mono text-[48px] font-medium leading-none tracking-tighter tabular-nums md:text-[64px]">
					{profile.minecraftVersion}
				</span>

				<div className="flex min-w-0 flex-col gap-1.5">
					<h1 className="m-0 flex items-center gap-2 truncate text-[24px] font-medium tracking-[-0.01em]">
						{profile.name}
					</h1>
					<p className="m-0 text-[13px] text-neutral-400">
						{loaderLabel(profile.profileTypeId)} · {Math.round(profile.ramMb / 1024)} Go · {profile.resolution} · {lastPlayedLabel(profile).toLowerCase()}
					</p>
				</div>

				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={onFavorite}
						aria-pressed={profile.favorite}
						aria-label={profile.favorite ? "Retirer des favoris" : "Mettre en favori"}
						className="grid size-10 place-items-center rounded-md border border-divider text-neutral-300 transition-colors hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					>
						<Star className={`size-4 ${profile.favorite ? "fill-accent-300 text-accent-300" : ""}`} />
					</button>
					<button
						type="button"
						onClick={onPlay}
						disabled={running}
						className="flex h-10 items-center gap-2 rounded-md bg-accent-700 px-5 text-[14px] font-medium text-accent-100 transition-[background-color,transform] hover:bg-accent-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
					>
						{running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4 fill-current" />}
						{running ? "En cours" : "Jouer"}
					</button>
				</div>
			</header>

			<section aria-label="Contenu de l'instance" className="flex flex-col gap-4 px-6 py-5">
				<div className="flex flex-wrap items-end justify-between gap-3 border-b border-divider">
					<div role="tablist" aria-label="Type de contenu" className="flex flex-wrap gap-1">
						{TABS.map((t) => {
							const selected = t.kind === tab;
							return (
								<button
									key={t.kind}
									type="button"
									role="tab"
									aria-selected={selected}
									onClick={() => setTab(t.kind)}
									className={`relative flex items-baseline gap-1.5 px-3 py-2.5 text-[13.5px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
										selected ? "text-ink" : "text-neutral-400 hover:text-ink"
									}`}
								>
									{t.label}
									<span className="font-mono text-[11.5px] tabular-nums text-neutral-500">
										{status === "ready" ? content[t.kind].length : ""}
									</span>
									{selected && (
										<motion.span
											layoutId="profile-tab"
											className="absolute inset-x-0 -bottom-px h-[2px] bg-accent"
											transition={{ type: "spring", stiffness: 380, damping: 32 }}
										/>
									)}
								</button>
							);
						})}
					</div>

					<div className="flex items-center gap-2 pb-2">
						<label className="relative">
							<span className="sr-only">Filtrer le contenu installé</span>
							<Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-neutral-500" />
							<input
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Filtrer"
								className="w-[180px] rounded-md border border-divider bg-well py-1.5 pl-8 pr-3 text-[13px] outline-none transition-colors focus:border-accent"
							/>
						</label>
						<button
							type="button"
							onClick={() => onBrowse(tab)}
							className="flex items-center gap-1.5 rounded-md border border-divider px-3 py-1.5 text-[13px] font-medium transition-colors hover:border-accent-700 hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						>
							<Plus className="size-3.5" />
							Ajouter
						</button>
					</div>
				</div>

				<div role="tabpanel" aria-label={current.label}>
					{status === "loading" && <ContentSkeleton />}

					{status === "error" && (
						<div role="alert" className="flex flex-col items-start gap-3 py-8">
							<p className="m-0 text-[14px] text-danger">{errorText}</p>
							<button
								type="button"
								onClick={() => void load()}
								className="flex items-center gap-2 rounded-md border border-divider px-3 py-2 text-[13.5px] hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							>
								<RefreshCw className="size-4" />
								Réessayer
							</button>
						</div>
					)}

					{status === "ready" && content[tab].length === 0 && (
						<div className="flex flex-col items-start gap-3 py-10">
							<p className="m-0 text-[15px] font-medium">{current.empty}</p>
							<p className="m-0 max-w-[52ch] text-[13.5px] leading-relaxed text-neutral-400">
								{tab === "mod"
									? `Ajoute des mods compatibles avec ${profile.minecraftVersion} depuis Modrinth. Les dépendances sont installées avec eux.`
									: `Ajoute-en depuis Modrinth : ils seront rangés dans le bon dossier de l'instance.`}
							</p>
							<button
								type="button"
								onClick={() => onBrowse(tab)}
								className="flex items-center gap-2 rounded-md bg-accent-700 px-4 py-2 text-[13.5px] font-medium text-accent-100 transition-colors hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							>
								<Plus className="size-4" />
								Parcourir le catalogue
							</button>
						</div>
					)}

					{status === "ready" && content[tab].length > 0 && visible.length === 0 && (
						<p className="m-0 py-10 text-[13.5px] text-neutral-400">Rien ne correspond à « {query} ».</p>
					)}

					{status === "ready" && visible.length > 0 && (
						<ul className="m-0 flex list-none flex-col divide-y divide-divider p-0">
							{visible.map((item) => (
								<ContentRow
									key={item.fileName}
									item={item}
									kind={tab}
									profileId={profile.id}
									onChange={(next) => replace(tab, (items) => items.map((i) => (i.fileName === item.fileName ? next : i)))}
									onRemoved={() => replace(tab, (items) => items.filter((i) => i.fileName !== item.fileName))}
								/>
							))}
						</ul>
					)}
				</div>
			</section>

			<InstanceSettings
				open={settingsOpen}
				profile={profile}
				config={config}
				onClose={() => setSettingsOpen(false)}
				onRefresh={onRefresh}
				onDelete={async () => {
					await onDelete();
					setSettingsOpen(false);
					onBack();
				}}
			/>
		</div>
	);
}

function ContentRow({
	item,
	kind,
	profileId,
	onChange,
	onRemoved,
}: {
	item: InstalledMod;
	kind: ContentType;
	profileId: string;
	onChange: (next: InstalledMod) => void;
	onRemoved: () => void;
}) {
	const [busy, setBusy] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!confirming) return;
		const timer = setTimeout(() => setConfirming(false), 3500);
		return () => clearTimeout(timer);
	}, [confirming]);

	async function toggle() {
		setBusy(true);
		setError(null);
		try {
			// Le serveur renomme le fichier (.disabled): on prend sa reponse, pas notre supposition.
			onChange(await toggleMod(profileId, item.fileName, kind));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Changement impossible");
		} finally {
			setBusy(false);
		}
	}

	async function remove() {
		setBusy(true);
		setError(null);
		try {
			await removeMod(profileId, item.fileName, kind);
			onRemoved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Suppression impossible");
			setBusy(false);
		}
	}

	const title = item.name ?? item.fileName.replace(/\.(jar|zip)(\.disabled)?$/i, "");

	return (
		<li className={`flex items-center gap-4 py-3 transition-opacity ${item.enabled ? "" : "opacity-55"}`}>
			<span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-sm bg-well text-neutral-400">
				{item.iconUrl ? (
					<img src={item.iconUrl} alt="" loading="lazy" className="size-full object-cover" />
				) : (
					<Package className="size-[18px]" />
				)}
			</span>

			<span className="flex min-w-0 flex-1 flex-col gap-px">
				<span className="truncate text-[14px] font-medium">{title}</span>
				<span className="truncate font-mono text-[11.5px] text-neutral-500">{item.fileName}</span>
				{error && <span role="alert" className="text-[12px] text-danger">{error}</span>}
			</span>

			<span className="hidden shrink-0 font-mono text-[12px] tabular-nums text-neutral-400 sm:block">
				{formatBytes(item.size)}
			</span>

			<button
				type="button"
				role="switch"
				aria-checked={item.enabled}
				aria-label={`${item.enabled ? "Désactiver" : "Activer"} ${title}`}
				disabled={busy}
				onClick={toggle}
				className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
					item.enabled ? "bg-accent-600" : "bg-neutral-700"
				}`}
			>
				<span
					className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-ink transition-transform ${
						item.enabled ? "translate-x-4" : ""
					}`}
				/>
			</button>

			<button
				type="button"
				aria-label={confirming ? `Confirmer la suppression de ${title}` : `Supprimer ${title}`}
				disabled={busy}
				onClick={() => (confirming ? void remove() : setConfirming(true))}
				className={`grid h-8 shrink-0 place-items-center rounded-md px-2 text-[12.5px] transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger ${
					confirming ? "bg-danger-dim text-ink" : "w-8 text-neutral-500 hover:bg-well hover:text-danger"
				}`}
			>
				{confirming ? "Supprimer ?" : <Trash2 className="size-4" />}
			</button>
		</li>
	);
}

/** Des lignes de la hauteur des vraies, pour que la page ne saute pas a l'arrivee des donnees. */
function ContentSkeleton() {
	return (
		<ul aria-label="Chargement" className="m-0 flex list-none flex-col divide-y divide-divider p-0">
			{Array.from({ length: 6 }, (_, i) => (
				<li key={i} className="flex items-center gap-4 py-3">
					<span className="size-10 shrink-0 animate-pulse rounded-sm bg-well" />
					<span className="flex flex-1 flex-col gap-1.5">
						<span className="h-3.5 w-1/3 animate-pulse rounded-sm bg-well" />
						<span className="h-3 w-1/2 animate-pulse rounded-sm bg-well/60" />
					</span>
				</li>
			))}
		</ul>
	);
}

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { AlertTriangle, Check, Download, Loader2, Package, RefreshCw, Search } from "lucide-react";
import type { LauncherProfile } from "@paranoia/contracts";

import {
	installMod,
	installModpack,
	listInstalledMods,
	listProjectVersions,
	searchMods,
	type CatalogKind,
	type ContentType,
	type ModSearchHit,
} from "../../../shared/api/modsClient";
import { formatCount } from "../../lib/profileFormat";
import { ModDetailsModal } from "../tabs/ModDetailsModal";
import { ScreenHeader } from "./ScreenHeader";

type ModsScreenProps = {
	profiles: LauncherProfile[];
	selectedProfileId: string;
	setSelectedProfileId: (id: string) => void;
	kind: CatalogKind;
	setKind: (kind: CatalogKind) => void;
	refreshProfiles: () => Promise<unknown>;
	onOpenProfile: (profileId: string) => void;
	onGoProfiles: () => void;
	setError: (message: string | null) => void;
};

const KINDS: { kind: CatalogKind; label: string; hint: string }[] = [
	{ kind: "mod", label: "Mods", hint: "Ajoutés à l'instance choisie, avec leurs dépendances." },
	{ kind: "modpack", label: "Modpacks", hint: "Chaque modpack crée sa propre instance, mods compris." },
	{ kind: "shader", label: "Shaders", hint: "Rangés dans le dossier shaderpacks de l'instance." },
	{ kind: "resourcepack", label: "Packs de ressources", hint: "Rangés dans le dossier resourcepacks de l'instance." },
	{ kind: "datapack", label: "Datapacks", hint: "Rangés dans le dossier datapacks de l'instance." },
];

const PAGE_SIZE = 20;

type Notice = { tone: "ok" | "error"; text: string; openProfileId?: string };

/**
 * Le catalogue Modrinth: on cherche ici, on gere le contenu installe sur la
 * fiche de chaque instance.
 *
 * <p>Un modpack n'est pas un contenu comme les autres: il ne se pose pas dans
 * une instance, il en cree une. Le selecteur d'instance disparait donc pour
 * lui, et l'ecran le dit.
 */
export function ModsScreen({
	profiles,
	selectedProfileId,
	setSelectedProfileId,
	kind,
	setKind,
	refreshProfiles,
	onOpenProfile,
	onGoProfiles,
	setError,
}: ModsScreenProps) {
	const profile = profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null;
	const isModpack = kind === "modpack";
	const needsProfile = !isModpack;

	const [query, setQuery] = useState("");
	const [hits, setHits] = useState<ModSearchHit[]>([]);
	const [total, setTotal] = useState(0);
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
	const [errorText, setErrorText] = useState("");
	const [loadingMore, setLoadingMore] = useState(false);
	const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
	const [busyId, setBusyId] = useState<string | null>(null);
	const [notice, setNotice] = useState<Notice | null>(null);
	const [details, setDetails] = useState<ModSearchHit | null>(null);

	// Une reponse lente ne doit pas ecraser celle de la recherche suivante.
	const requestId = useRef(0);

	const gameVersion = needsProfile ? profile?.minecraftVersion : undefined;
	const searchLoader = kind === "mod" ? "fabric" : undefined;

	const runSearch = useCallback(async () => {
		const id = ++requestId.current;
		setStatus("loading");
		try {
			const result = await searchMods({
				query,
				gameVersion,
				loader: searchLoader,
				projectType: kind,
				limit: PAGE_SIZE,
				offset: 0,
			});
			if (id !== requestId.current) return;
			setHits(result.hits);
			setTotal(result.total);
			setStatus("ready");
		} catch (err) {
			if (id !== requestId.current) return;
			setErrorText(err instanceof Error ? err.message : "Recherche Modrinth impossible");
			setStatus("error");
		}
	}, [query, gameVersion, searchLoader, kind]);

	// La frappe est temporisee, le changement de type ou d'instance ne l'est pas moins:
	// un seul chemin pour toutes les relances.
	useEffect(() => {
		if (needsProfile && !profile) return;
		const timer = setTimeout(() => void runSearch(), 260);
		return () => clearTimeout(timer);
	}, [runSearch, needsProfile, profile]);

	// Ce qui est deja installe sur l'instance, pour ne pas proposer deux fois la meme chose.
	useEffect(() => {
		setInstalledIds(new Set());
		if (!profile || isModpack) return;

		let cancelled = false;
		listInstalledMods(profile.id, kind as ContentType)
			.then((items) => {
				if (!cancelled) setInstalledIds(new Set(items.map((i) => i.projectId).filter((p): p is string => !!p)));
			})
			.catch(() => {
				// Sans cette liste, les boutons restent « Installer »: rien de bloquant.
			});
		return () => {
			cancelled = true;
		};
	}, [profile?.id, kind, isModpack, profile]);

	async function loadMore() {
		setLoadingMore(true);
		try {
			const result = await searchMods({
				query,
				gameVersion,
				loader: searchLoader,
				projectType: kind,
				limit: PAGE_SIZE,
				offset: hits.length,
			});
			setHits((current) => [...current, ...result.hits.filter((h) => !current.some((c) => c.projectId === h.projectId))]);
		} catch (err) {
			setNotice({ tone: "error", text: err instanceof Error ? err.message : "Chargement impossible" });
		} finally {
			setLoadingMore(false);
		}
	}

	async function install(hit: ModSearchHit) {
		setBusyId(hit.projectId);
		setNotice(null);
		try {
			if (isModpack) {
				const created = await installModpack({ projectId: hit.projectId, name: hit.title });
				await refreshProfiles();
				const warnings = created.warnings ?? [];
				setNotice({
					tone: "ok",
					text: `« ${created.name} » est installée.${warnings.length ? ` ${warnings.join(" ")}` : ""}`,
					openProfileId: created.id,
				});
				return;
			}

			if (!profile) throw new Error("Crée d'abord une instance pour y installer du contenu.");
			const loader = kind === "mod" ? "fabric" : undefined;

			// Du plus precis au plus large: version exacte du jeu, puis loader seul, puis la derniere.
			let versions = await listProjectVersions(hit.projectId, { gameVersion: profile.minecraftVersion, loader });
			if (versions.length === 0 && kind === "mod") versions = await listProjectVersions(hit.projectId, { loader });
			if (versions.length === 0) versions = await listProjectVersions(hit.projectId, {});

			const version = versions[0];
			if (!version) throw new Error(`Aucune version téléchargeable pour « ${hit.title} ».`);

			const result = await installMod({
				profileId: profile.id,
				projectId: hit.projectId,
				versionId: version.versionId,
				gameVersion: profile.minecraftVersion,
				loader,
				projectType: kind as ContentType,
			});

			setInstalledIds((current) => new Set(current).add(hit.projectId));
			const deps = result.dependencies.length;
			setNotice({
				tone: "ok",
				text: `${hit.title} est installé sur « ${profile.name} »${deps ? `, avec ${deps} dépendance${deps > 1 ? "s" : ""}` : ""}.`,
				openProfileId: profile.id,
			});
		} catch (err) {
			const text = err instanceof Error ? err.message : "Installation impossible";
			setNotice({ tone: "error", text });
			setError(text);
		} finally {
			setBusyId(null);
		}
	}

	const current = KINDS.find((k) => k.kind === kind) ?? KINDS[0]!;
	const remaining = useMemo(() => Math.max(total - hits.length, 0), [total, hits.length]);

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-5 overflow-auto p-6">
			<ScreenHeader title="Mods et modpacks" subtitle="Le catalogue Modrinth. Le contenu déjà installé se gère sur la fiche de chaque profil." />

			<div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-divider">
				<div role="tablist" aria-label="Type de contenu" className="flex flex-wrap gap-1">
					{KINDS.map((k) => {
						const selected = k.kind === kind;
						return (
							<button
								key={k.kind}
								type="button"
								role="tab"
								aria-selected={selected}
								onClick={() => {
									setKind(k.kind);
									setNotice(null);
								}}
								className={`relative px-3 py-2.5 text-[13.5px] transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
									selected ? "text-ink" : "text-neutral-400 hover:text-ink"
								}`}
							>
								{k.label}
								{selected && (
									<motion.span
										layoutId="mods-kind"
										className="absolute inset-x-0 -bottom-px h-[2px] bg-accent"
										transition={{ type: "spring", stiffness: 380, damping: 32 }}
									/>
								)}
							</button>
						);
					})}
				</div>

				{needsProfile && profiles.length > 0 && (
					<label className="flex items-center gap-2 pb-2 text-[13px] text-neutral-300">
						Installer dans
						<select
							value={profile?.id ?? ""}
							onChange={(e) => setSelectedProfileId(e.target.value)}
							className="max-w-[220px] cursor-pointer truncate rounded-md border border-divider bg-well px-2.5 py-1.5 text-[13px] text-ink outline-none transition-colors focus:border-accent"
						>
							{profiles.map((p) => (
								<option key={p.id} value={p.id}>
									{p.name} ({p.minecraftVersion})
								</option>
							))}
						</select>
					</label>
				)}
			</div>

			<div className="flex flex-wrap items-center justify-between gap-3">
				<label className="relative min-w-[240px] flex-1 sm:max-w-[420px]">
					<span className="sr-only">Rechercher dans le catalogue</span>
					<Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-neutral-500" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder={`Chercher parmi les ${current.label.toLowerCase()}`}
						className="w-full rounded-md border border-divider bg-well py-2 pl-9 pr-3 text-[14px] outline-none transition-colors focus:border-accent"
					/>
				</label>
				<p className="m-0 text-[12.5px] text-neutral-400">
					{current.hint}
					{needsProfile && profile && (
						<span className="font-mono tabular-nums"> Compatible {profile.minecraftVersion}.</span>
					)}
				</p>
			</div>

			<div aria-live="polite">
				{notice && (
					<div
						role={notice.tone === "error" ? "alert" : "status"}
						className={`flex flex-wrap items-center gap-x-4 gap-y-2 border-l-0 py-1 text-[13.5px] ${
							notice.tone === "error" ? "text-danger" : "text-neutral-200"
						}`}
					>
						<span className="flex items-center gap-2">
							{notice.tone === "error" ? <AlertTriangle className="size-4 shrink-0" /> : <Check className="size-4 shrink-0 text-accent-300" />}
							{notice.text}
						</span>
						{notice.openProfileId && (
							<button
								type="button"
								onClick={() => onOpenProfile(notice.openProfileId!)}
								className="rounded-md border border-divider px-2.5 py-1 text-[12.5px] font-medium text-ink hover:border-accent-700 hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							>
								Ouvrir la fiche
							</button>
						)}
					</div>
				)}
			</div>

			{needsProfile && profiles.length === 0 ? (
				<div className="flex flex-col items-start gap-3 py-10">
					<p className="m-0 text-[15px] font-medium">Aucune instance pour recevoir du contenu.</p>
					<p className="m-0 max-w-[52ch] text-[13.5px] leading-relaxed text-neutral-400">
						Crée une instance, ou installe un modpack : il arrive avec sa propre instance.
					</p>
					<div className="flex gap-3">
						<button
							type="button"
							onClick={() => setKind("modpack")}
							className="rounded-md bg-accent-700 px-4 py-2 text-[13.5px] font-medium text-accent-100 hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						>
							Voir les modpacks
						</button>
						<button
							type="button"
							onClick={onGoProfiles}
							className="rounded-md border border-divider px-4 py-2 text-[13.5px] font-medium hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						>
							Aller aux profils
						</button>
					</div>
				</div>
			) : (
				<>
					{status === "loading" && <ResultsSkeleton />}

					{status === "error" && (
						<div role="alert" className="flex flex-col items-start gap-3 py-8">
							<p className="m-0 text-[14px] text-danger">{errorText}</p>
							<button
								type="button"
								onClick={() => void runSearch()}
								className="flex items-center gap-2 rounded-md border border-divider px-3 py-2 text-[13.5px] hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							>
								<RefreshCw className="size-4" />
								Réessayer
							</button>
						</div>
					)}

					{status === "ready" && hits.length === 0 && (
						<div className="flex flex-col gap-1 py-10">
							<p className="m-0 text-[15px] font-medium">Aucun résultat{query ? ` pour « ${query} »` : ""}.</p>
							<p className="m-0 text-[13.5px] text-neutral-400">
								{needsProfile && profile
									? `Rien n'existe pour la ${profile.minecraftVersion} avec ces mots. Essaie une autre instance ou un terme plus court.`
									: "Essaie un terme plus court."}
							</p>
						</div>
					)}

					{status === "ready" && hits.length > 0 && (
						<>
							<ul className="m-0 flex list-none flex-col divide-y divide-divider p-0">
								{hits.map((hit) => (
									<ResultRow
										key={hit.projectId}
										hit={hit}
										installed={installedIds.has(hit.projectId)}
										busy={busyId === hit.projectId}
										disabled={busyId !== null}
										isModpack={isModpack}
										onInstall={() => void install(hit)}
										onDetails={() => setDetails(hit)}
									/>
								))}
							</ul>

							{remaining > 0 && (
								<button
									type="button"
									onClick={() => void loadMore()}
									disabled={loadingMore}
									className="flex items-center gap-2 self-start rounded-md border border-divider px-4 py-2 text-[13.5px] font-medium transition-colors hover:bg-well disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								>
									{loadingMore && <Loader2 className="size-4 animate-spin" />}
									Afficher la suite
									<span className="font-mono tabular-nums text-neutral-400">{formatCount(remaining)} restants</span>
								</button>
							)}
						</>
					)}
				</>
			)}

			<ModDetailsModal
				hit={details}
				isOpen={details !== null}
				onClose={() => setDetails(null)}
				onInstall={(hit) => void install(hit)}
				isInstalling={details !== null && busyId === details.projectId}
				isInstalled={details !== null && installedIds.has(details.projectId)}
				gameVersion={gameVersion}
				loader={searchLoader}
			/>
		</div>
	);
}

function ResultRow({
	hit,
	installed,
	busy,
	disabled,
	isModpack,
	onInstall,
	onDetails,
}: {
	hit: ModSearchHit;
	installed: boolean;
	busy: boolean;
	disabled: boolean;
	isModpack: boolean;
	onInstall: () => void;
	onDetails: () => void;
}) {
	return (
		<li className="flex items-start gap-4 py-4">
			<button
				type="button"
				onClick={onDetails}
				aria-label={`Détails de ${hit.title}`}
				className="flex min-w-0 flex-1 items-start gap-4 rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
			>
				<span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-sm bg-well text-neutral-400">
					{hit.iconUrl ? (
						<img src={hit.iconUrl} alt="" loading="lazy" className="size-full object-cover" />
					) : (
						<Package className="size-5" />
					)}
				</span>
				<span className="flex min-w-0 flex-col gap-1">
					<span className="flex flex-wrap items-baseline gap-x-2">
						<span className="text-[14.5px] font-medium">{hit.title}</span>
						<span className="text-[12.5px] text-neutral-400">par {hit.author}</span>
					</span>
					<span className="line-clamp-2 max-w-[70ch] text-[13px] leading-snug text-neutral-300">{hit.description}</span>
					<span className="flex flex-wrap gap-x-3 text-[12px] text-neutral-500">
						<span className="font-mono tabular-nums">{formatCount(hit.downloads)} téléchargements</span>
						{hit.categories.slice(0, 3).map((category) => (
							<span key={category}>{category}</span>
						))}
					</span>
				</span>
			</button>

			<button
				type="button"
				onClick={onInstall}
				disabled={disabled || installed}
				className={`flex h-9 shrink-0 items-center gap-2 rounded-md border px-3.5 text-[13px] font-medium transition-[background-color,border-color,transform] active:scale-[0.98] disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
					installed
						? "border-transparent text-neutral-400"
						: "border-divider hover:border-accent-700 hover:bg-well disabled:opacity-50"
				}`}
			>
				{busy ? <Loader2 className="size-4 animate-spin" /> : installed ? <Check className="size-4 text-accent-300" /> : <Download className="size-4" />}
				{busy ? (isModpack ? "Installation du pack" : "Installation") : installed ? "Installé" : isModpack ? "Créer l'instance" : "Installer"}
			</button>
		</li>
	);
}

function ResultsSkeleton() {
	return (
		<ul aria-label="Chargement des résultats" className="m-0 flex list-none flex-col divide-y divide-divider p-0">
			{Array.from({ length: 6 }, (_, i) => (
				<li key={i} className="flex items-start gap-4 py-4">
					<span className="size-12 shrink-0 animate-pulse rounded-sm bg-well" />
					<span className="flex flex-1 flex-col gap-2">
						<span className="h-3.5 w-1/4 animate-pulse rounded-sm bg-well" />
						<span className="h-3 w-3/5 animate-pulse rounded-sm bg-well/60" />
						<span className="h-3 w-1/3 animate-pulse rounded-sm bg-well/40" />
					</span>
				</li>
			))}
		</ul>
	);
}

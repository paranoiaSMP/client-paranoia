import { useCallback, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { AlertTriangle, ArrowLeft, Check, FileUp, Loader2, RefreshCw } from "lucide-react";
import type { LauncherProfile } from "@paranoia/contracts";

import {
	importArchive,
	importPaths,
	inspectSources,
	migrateProfile,
	type ImportedProfile,
	type SourceInfo,
} from "../../../shared/api/profilesClient";
import { loaderLabel } from "../../lib/profileFormat";

type DetectedProfile = { id: string; label: string; options_path: string; launcher: string };

type Source = DetectedProfile & { info: SourceInfo | null };

type ImportScreenProps = {
	onBack: () => void;
	/** Rafraichit la liste des profils apres un import. */
	onRefresh: () => Promise<unknown>;
	/** Ouvre la fiche du profil cree. */
	onOpenProfile: (profile: LauncherProfile) => void;
};

type Result = { profile: ImportedProfile | null; warnings: string[] };

const FORMATS = [
	[".mrpack", "Modrinth"],
	[".zip", "CurseForge, Prism, MultiMC, PolyMC"],
	[".lcpack", "Lunar Client"],
	[".paraconf", "Paranoia"],
] as const;

function displayName(source: Source): string {
	return source.info?.name ?? source.label.replace(`${source.launcher} : `, "");
}

/**
 * Reprendre ses instances depuis un autre launcher, ou depuis un fichier.
 *
 * <p>Les instances detectees montrent ce que l'import va reellement creer: la
 * version, le loader, le nombre de mods. Un chemin de dossier ne dit pas si on
 * importe la bonne instance, et un loader que le launcher ne sait pas lancer
 * vaut mieux d'etre signale avant qu'apres.
 */
export function ImportScreen({ onBack, onRefresh, onOpenProfile }: ImportScreenProps) {
	const [sources, setSources] = useState<Source[]>([]);
	const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
	const [errorText, setErrorText] = useState("");
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [name, setName] = useState("");
	const [busy, setBusy] = useState<"instance" | "file" | null>(null);
	const [failure, setFailure] = useState<string | null>(null);
	const [result, setResult] = useState<Result | null>(null);

	const detect = useCallback(async () => {
		setStatus("loading");
		try {
			const detected = await invoke<DetectedProfile[]>("get_detected_profiles");

			// La description est un confort: sans elle, les instances restent importables.
			let infos: SourceInfo[] = [];
			try {
				infos = await inspectSources(detected.map((d) => d.options_path));
			} catch {
				infos = [];
			}
			const byPath = new Map(infos.map((i) => [i.optionsPath, i]));

			setSources(detected.map((d) => ({ ...d, info: byPath.get(d.options_path) ?? null })));
			setStatus("ready");
		} catch (err) {
			setErrorText(typeof err === "string" ? err : err instanceof Error ? err.message : "Détection impossible");
			setStatus("error");
		}
	}, []);

	useEffect(() => {
		void detect();
	}, [detect]);

	const groups = useMemo(() => {
		const map = new Map<string, Source[]>();
		for (const s of sources) map.set(s.launcher, [...(map.get(s.launcher) ?? []), s]);
		return [...map.entries()];
	}, [sources]);

	const selected = sources.find((s) => s.id === selectedId) ?? null;

	function select(source: Source) {
		setSelectedId(source.id);
		setName(displayName(source));
		setFailure(null);
		setResult(null);
	}

	async function importInstance() {
		if (!selected) return;
		setBusy("instance");
		setFailure(null);
		try {
			const profile = await migrateProfile({
				name: name.trim() || displayName(selected),
				minecraftVersion: selected.info?.minecraftVersion ?? "1.21.1",
				profileTypeId: selected.info?.profileTypeId ?? "vanilla",
				graphicsModeId: "fancy",
				ramMb: 4096,
				resolution: "1920x1080",
				optionsTxtPath: selected.options_path,
			});
			await onRefresh();
			setResult({ profile, warnings: profile.warnings ?? [] });
		} catch (err) {
			setFailure(err instanceof Error ? err.message : "Import impossible");
		} finally {
			setBusy(null);
		}
	}

	async function importFile() {
		const file = await open({
			multiple: false,
			filters: [{ name: "Packs et instances", extensions: ["mrpack", "zip", "lcpack", "paraconf"] }],
		});
		if (typeof file !== "string") return;

		setBusy("file");
		setFailure(null);
		setResult(null);
		try {
			if (/\.(mrpack|zip)$/i.test(file)) {
				const profile = await importArchive(file);
				await onRefresh();
				setResult({ profile, warnings: profile.warnings ?? [] });
			} else {
				await importPaths([file]);
				await onRefresh();
				setResult({ profile: null, warnings: [] });
			}
		} catch (err) {
			setFailure(err instanceof Error ? err.message : "Import impossible");
		} finally {
			setBusy(null);
		}
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-8 overflow-auto p-6">
			<div className="flex flex-col gap-4">
				<button
					type="button"
					onClick={onBack}
					className="-ml-2 flex items-center gap-2 self-start rounded-md px-2 py-1.5 text-[13.5px] text-neutral-300 transition-colors hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					<ArrowLeft className="size-4" />
					Profils
				</button>
				<header className="flex flex-col gap-1.5">
					<h1 className="m-0 text-[26px] font-medium tracking-[-0.01em]">Importer</h1>
					<p className="m-0 max-w-[60ch] text-sm text-neutral-300">
						Reprends une instance d'un autre launcher avec ses mods, sa configuration et ses sauvegardes, ou installe un pack depuis un fichier.
					</p>
				</header>
			</div>

			<div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
				<section aria-label="Instances détectées" className="flex min-w-0 flex-col gap-6">
					{status === "loading" && <DetectionSkeleton />}

					{status === "error" && (
						<div role="alert" className="flex flex-col items-start gap-3 py-4">
							<p className="m-0 text-[14px] text-danger">{errorText}</p>
							<p className="m-0 max-w-[52ch] text-[13px] text-neutral-400">
								La détection des launchers n'est disponible que dans l'application. Tu peux quand même importer un fichier.
							</p>
							<button
								type="button"
								onClick={() => void detect()}
								className="flex items-center gap-2 rounded-md border border-divider px-3 py-2 text-[13.5px] hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							>
								<RefreshCw className="size-4" />
								Réessayer
							</button>
						</div>
					)}

					{status === "ready" && groups.length === 0 && (
						<div className="flex flex-col gap-2 border-b border-divider pb-8">
							<h2 className="m-0 text-[18px] font-medium">Aucune instance trouvée</h2>
							<p className="m-0 max-w-[54ch] text-[14px] leading-relaxed text-neutral-300">
								Aucun dossier de Prism, MultiMC, CurseForge, Modrinth, Lunar, GDLauncher, ATLauncher ou du launcher officiel n'a été trouvé sur cette machine. Si ton launcher est installé ailleurs, exporte l'instance en .zip ou .mrpack et importe le fichier.
							</p>
						</div>
					)}

					{status === "ready" &&
						groups.map(([launcher, items]) => (
							<div key={launcher} role="radiogroup" aria-label={launcher} className="flex flex-col">
								<h2 className="m-0 mb-1 flex items-baseline gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
									{launcher}
									<span className="font-mono tabular-nums text-neutral-500">{items.length}</span>
								</h2>
								<div className="flex flex-col divide-y divide-divider border-y border-divider">
									{items.map((source) => (
										<SourceRow
											key={source.id}
											source={source}
											selected={source.id === selectedId}
											onSelect={() => select(source)}
										/>
									))}
								</div>
							</div>
						))}
				</section>

				<aside aria-label="Import" className="flex flex-col gap-8 lg:sticky lg:top-0 lg:self-start">
					<section className="flex flex-col gap-4" aria-live="polite">
						<h2 className="m-0 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
							Instance à reprendre
						</h2>

						{result ? (
							<ResultPanel result={result} onOpen={onOpenProfile} />
						) : selected ? (
							<div className="flex flex-col gap-4">
								<dl className="m-0 grid grid-cols-3 gap-4">
									<Fact label="Version" value={selected.info?.minecraftVersion ?? "inconnue"} />
									<Fact label="Loader" value={selected.info ? loaderLabel(selected.info.profileTypeId ?? (selected.info.unsupportedLoader ?? "vanilla")) : "inconnu"} />
									<Fact label="Mods" value={selected.info ? String(selected.info.modCount) : "--"} />
								</dl>

								{selected.info?.unsupportedLoader && (
									<p className="m-0 flex items-start gap-2 text-[13px] leading-snug text-danger">
										<AlertTriangle className="mt-0.5 size-4 shrink-0" />
										Le loader {selected.info.unsupportedLoader} n'est pas encore géré : l'instance sera lancée sans ses mods.
									</p>
								)}

								<div className="flex flex-col gap-2">
									<label htmlFor="import-name" className="text-[13px] font-medium">Nom de l'instance</label>
									<input
										id="import-name"
										value={name}
										onChange={(e) => setName(e.target.value)}
										className="w-full rounded-md border border-divider bg-well px-3 py-2 text-[14px] outline-none transition-colors focus:border-accent"
									/>
								</div>

								<p className="m-0 text-[12.5px] leading-snug text-neutral-400">
									Le dossier est copié : l'instance d'origine n'est ni modifiée ni supprimée.
								</p>

								{failure && <p role="alert" className="m-0 text-[13px] text-danger">{failure}</p>}

								<button
									type="button"
									onClick={importInstance}
									disabled={busy !== null}
									className="flex items-center justify-center gap-2 rounded-md bg-accent-700 px-4 py-2.5 text-[14px] font-medium text-accent-100 transition-[background-color,transform] hover:bg-accent-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
								>
									{busy === "instance" && <Loader2 className="size-4 animate-spin" />}
									{busy === "instance" ? "Copie en cours" : "Importer l'instance"}
								</button>
							</div>
						) : (
							<p className="m-0 text-[13.5px] leading-relaxed text-neutral-400">
								Choisis une instance dans la liste pour voir ce qui sera repris.
							</p>
						)}
					</section>

					<section className="flex flex-col gap-3 border-t border-divider pt-6">
						<h2 className="m-0 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
							Depuis un fichier
						</h2>
						<button
							type="button"
							onClick={importFile}
							disabled={busy !== null}
							className="flex items-center justify-center gap-2 rounded-md border border-divider px-4 py-2.5 text-[14px] font-medium transition-colors hover:border-accent-700 hover:bg-well disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
						>
							{busy === "file" ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
							{busy === "file" ? "Import en cours" : "Choisir un fichier"}
						</button>
						<p className="m-0 text-[12.5px] text-neutral-400">
							Tu peux aussi déposer un fichier n'importe où dans la fenêtre.
						</p>
						<dl className="m-0 flex flex-col gap-1.5">
							{FORMATS.map(([ext, from]) => (
								<div key={ext} className="flex items-baseline gap-3 text-[12.5px]">
									<dt className="w-[72px] shrink-0 font-mono text-neutral-300">{ext}</dt>
									<dd className="m-0 text-neutral-400">{from}</dd>
								</div>
							))}
						</dl>
					</section>
				</aside>
			</div>
		</div>
	);
}

function SourceRow({ source, selected, onSelect }: { source: Source; selected: boolean; onSelect: () => void }) {
	const info = source.info;
	return (
		<button
			type="button"
			role="radio"
			aria-checked={selected}
			onClick={onSelect}
			className={`flex items-center gap-4 px-3 py-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
				selected ? "bg-accent-900" : "hover:bg-well"
			}`}
		>
			<span
				aria-hidden
				className={`grid size-5 shrink-0 place-items-center rounded-full border ${
					selected ? "border-accent bg-accent text-ground" : "border-neutral-600"
				}`}
			>
				{selected && <Check className="size-3" strokeWidth={3} />}
			</span>
			<span className="flex min-w-0 flex-1 flex-col gap-px">
				<span className="truncate text-[14.5px] font-medium">{displayName(source)}</span>
				<span className="truncate font-mono text-[11.5px] text-neutral-500">{source.options_path}</span>
			</span>
			<span className="hidden shrink-0 flex-col items-end gap-px text-right sm:flex">
				<span className="font-mono text-[12.5px] tabular-nums text-ink">
					{info?.minecraftVersion ?? "version inconnue"}
				</span>
				<span className="text-[12px] text-neutral-400">
					{info ? `${loaderLabel(info.profileTypeId ?? info.unsupportedLoader ?? "vanilla")} · ${info.modCount} mod${info.modCount > 1 ? "s" : ""}` : "non analysée"}
				</span>
			</span>
		</button>
	);
}

function Fact({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex min-w-0 flex-col gap-0.5">
			<dt className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">{label}</dt>
			<dd className="m-0 truncate font-mono text-[14px] tabular-nums">{value}</dd>
		</div>
	);
}

function ResultPanel({ result, onOpen }: { result: Result; onOpen: (profile: LauncherProfile) => void }) {
	const created = result.profile;
	return (
		<div className="flex flex-col gap-4">
			<p className="m-0 flex items-center gap-2 text-[14px] font-medium">
				<Check className="size-4 text-accent-300" />
				{created ? `« ${created.name} » est prête.` : "Fichier importé."}
			</p>

			{result.warnings.length > 0 && (
				<ul className="m-0 flex list-none flex-col gap-2 p-0">
					{result.warnings.map((warning) => (
						<li key={warning} className="flex items-start gap-2 text-[13px] leading-snug text-neutral-300">
							<AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
							{warning}
						</li>
					))}
				</ul>
			)}

			{created && (
				<button
					type="button"
					onClick={() => onOpen(created)}
					className="flex items-center justify-center gap-2 rounded-md bg-accent-700 px-4 py-2.5 text-[14px] font-medium text-accent-100 transition-colors hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					Ouvrir la fiche
				</button>
			)}
		</div>
	);
}

function DetectionSkeleton() {
	return (
		<div aria-label="Détection en cours" className="flex flex-col gap-3">
			<span className="h-3 w-28 animate-pulse rounded-sm bg-well" />
			<div className="flex flex-col divide-y divide-divider border-y border-divider">
				{Array.from({ length: 4 }, (_, i) => (
					<div key={i} className="flex items-center gap-4 px-3 py-3.5">
						<span className="size-5 shrink-0 animate-pulse rounded-full bg-well" />
						<span className="flex flex-1 flex-col gap-1.5">
							<span className="h-3.5 w-1/3 animate-pulse rounded-sm bg-well" />
							<span className="h-3 w-2/3 animate-pulse rounded-sm bg-well/60" />
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

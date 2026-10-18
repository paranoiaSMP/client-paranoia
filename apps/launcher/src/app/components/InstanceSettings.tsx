import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { invoke } from "@tauri-apps/api/core";
import { Copy, FolderOpen, Loader2, Trash2, X } from "lucide-react";
import type { LauncherProfile, RemoteConfiguration } from "@paranoia/contracts";

import { duplicateProfile, updateProfile } from "../../shared/api/profilesClient";
import { KeybindsImport } from "./KeybindsImport";

type InstanceSettingsProps = {
	open: boolean;
	profile: LauncherProfile;
	config: RemoteConfiguration | null;
	onClose: () => void;
	onRefresh: () => Promise<unknown> | void;
	onDelete: () => Promise<unknown> | void;
};

const SPRING = { type: "spring", stiffness: 260, damping: 30 } as const;

/**
 * Les reglages d'une instance, dans un panneau qui glisse depuis la droite.
 *
 * <p>Un panneau et non une fenetre centree: on garde la fiche sous les yeux,
 * donc la liste de mods dont on regle la memoire ou la version. Il se ferme a
 * Echap, au clic sur le voile et par son bouton, et rend le focus a la molette
 * qui l'a ouvert.
 */
export function InstanceSettings({ open, profile, config, onClose, onRefresh, onDelete }: InstanceSettingsProps) {
	const titleId = useId();
	const closeRef = useRef<HTMLButtonElement>(null);

	useEffect(() => {
		if (!open) return;
		closeRef.current?.focus();

		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [open, onClose]);

	// Le panneau demarre sous la barre de titre (48 px): reduire et fermer la
	// fenetre doivent rester accessibles pendant qu'il est ouvert.
	return (
		<AnimatePresence>
			{open && (
				<div className="fixed inset-x-0 bottom-0 top-12 z-40 flex justify-end">
					<motion.div
						aria-hidden
						className="absolute inset-0 bg-ground/70"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
					/>
					<motion.aside
						role="dialog"
						aria-modal="true"
						aria-labelledby={titleId}
						className="elev-lg relative flex h-full w-full max-w-[420px] flex-col bg-surface"
						initial={{ x: "100%" }}
						animate={{ x: 0 }}
						exit={{ x: "100%" }}
						transition={SPRING}
					>
						<header className="flex items-center justify-between gap-3 border-b border-divider px-5 py-4">
							<div className="flex min-w-0 flex-col">
								<h2 id={titleId} className="m-0 text-[16px] font-medium">
									Réglages de l'instance
								</h2>
								<p className="m-0 truncate text-[12.5px] text-neutral-400">{profile.name}</p>
							</div>
							<button
								ref={closeRef}
								type="button"
								aria-label="Fermer les réglages"
								onClick={onClose}
								className="grid size-8 shrink-0 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-well hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							>
								<X className="size-4" />
							</button>
						</header>

						<div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-5 py-6">
							<GeneralForm profile={profile} config={config} onRefresh={onRefresh} onSaved={onClose} />
							<KeybindsImport profile={profile} />
							<FolderAction profileId={profile.id} />
						</div>

						<DangerZone profile={profile} onRefresh={onRefresh} onDelete={onDelete} onDone={onClose} />
					</motion.aside>
				</div>
			)}
		</AnimatePresence>
	);
}

function GeneralForm({
	profile,
	config,
	onRefresh,
	onSaved,
}: {
	profile: LauncherProfile;
	config: RemoteConfiguration | null;
	onRefresh: () => Promise<unknown> | void;
	onSaved: () => void;
}) {
	const [name, setName] = useState(profile.name);
	const [version, setVersion] = useState(profile.minecraftVersion);
	const [ramMb, setRamMb] = useState(profile.ramMb || 4096);
	const [resolution, setResolution] = useState(profile.resolution || "1920x1080");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const ids = { name: useId(), version: useId(), ram: useId(), res: useId() };

	// Repart du profil quand on change d'instance ou qu'il est actualise.
	useEffect(() => {
		setName(profile.name);
		setVersion(profile.minecraftVersion);
		setRamMb(profile.ramMb || 4096);
		setResolution(profile.resolution || "1920x1080");
	}, [profile]);

	const versions = Array.from(new Set([profile.minecraftVersion, ...(config?.supportedMinecraftVersions ?? [])]));
	const dirty =
		name.trim() !== profile.name ||
		version !== profile.minecraftVersion ||
		ramMb !== profile.ramMb ||
		resolution.trim() !== profile.resolution;

	async function save(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError(null);
		try {
			await updateProfile(profile.id, {
				name: name.trim() || profile.name,
				minecraftVersion: version,
				ramMb,
				resolution: resolution.trim() || profile.resolution,
			});
			await onRefresh();
			onSaved();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Enregistrement impossible");
		} finally {
			setSaving(false);
		}
	}

	const field =
		"w-full rounded-md border border-divider bg-well px-3 py-2 text-[14px] text-ink outline-none transition-colors focus:border-accent";

	return (
		<form onSubmit={save} className="flex flex-col gap-5">
			<h3 className="m-0 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Général</h3>

			<div className="flex flex-col gap-2">
				<label htmlFor={ids.name} className="text-[13px] font-medium">Nom</label>
				<input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} className={field} required />
			</div>

			<div className="flex flex-col gap-2">
				<label htmlFor={ids.version} className="text-[13px] font-medium">Version de Minecraft</label>
				<select id={ids.version} value={version} onChange={(e) => setVersion(e.target.value)} className={`${field} cursor-pointer font-mono`}>
					{versions.map((v) => (
						<option key={v} value={v}>{v}</option>
					))}
				</select>
				{version !== profile.minecraftVersion && (
					<p className="m-0 text-[12px] text-neutral-400">
						Les mods installés restent ceux de {profile.minecraftVersion}. Vérifie qu'ils existent pour {version}.
					</p>
				)}
			</div>

			<div className="flex flex-col gap-2">
				<div className="flex items-baseline justify-between">
					<label htmlFor={ids.ram} className="text-[13px] font-medium">Mémoire allouée</label>
					<span className="font-mono text-[13px] tabular-nums text-ink">{Math.round(ramMb / 1024)} Go</span>
				</div>
				<input
					id={ids.ram}
					type="range"
					min={1024}
					max={16384}
					step={1024}
					value={ramMb}
					onChange={(e) => setRamMb(Number(e.target.value))}
					className="w-full cursor-pointer accent-accent"
				/>
				<div className="flex justify-between font-mono text-[11px] text-neutral-500">
					<span>1 Go</span>
					<span>16 Go</span>
				</div>
			</div>

			<div className="flex flex-col gap-2">
				<label htmlFor={ids.res} className="text-[13px] font-medium">Résolution</label>
				<input id={ids.res} value={resolution} onChange={(e) => setResolution(e.target.value)} placeholder="1920x1080" className={`${field} font-mono`} />
				<p className="m-0 text-[12px] text-neutral-400">Largeur et hauteur, par exemple 1920x1080.</p>
			</div>

			{error && <p role="alert" className="m-0 text-[13px] text-danger">{error}</p>}

			<button
				type="submit"
				disabled={!dirty || saving}
				className="flex items-center justify-center gap-2 rounded-md bg-accent-700 px-4 py-2.5 text-[14px] font-medium text-accent-100 transition-[background-color,transform] hover:bg-accent-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
			>
				{saving && <Loader2 className="size-4 animate-spin" />}
				{saving ? "Enregistrement" : "Enregistrer"}
			</button>
		</form>
	);
}

function FolderAction({ profileId }: { profileId: string }) {
	const [error, setError] = useState<string | null>(null);

	async function open() {
		setError(null);
		try {
			await invoke("open_instance_folder", { profileId });
		} catch (e) {
			setError(typeof e === "string" ? e : "Dossier introuvable. Lance l'instance une fois pour le créer.");
		}
	}

	return (
		<div className="flex flex-col gap-2">
			<h3 className="m-0 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">Dossier</h3>
			<button
				type="button"
				onClick={open}
				className="flex items-center gap-2 self-start rounded-md border border-divider px-3 py-2 text-[13.5px] font-medium transition-colors hover:border-accent-700 hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
			>
				<FolderOpen className="size-4" />
				Ouvrir le dossier de l'instance
			</button>
			<p className="m-0 text-[12px] text-neutral-400">Sauvegardes, captures, mods et options.txt.</p>
			{error && <p role="alert" className="m-0 text-[12px] text-danger">{error}</p>}
		</div>
	);
}

function DangerZone({
	profile,
	onRefresh,
	onDelete,
	onDone,
}: {
	profile: LauncherProfile;
	onRefresh: () => Promise<unknown> | void;
	onDelete: () => Promise<unknown> | void;
	onDone: () => void;
}) {
	const [duplicating, setDuplicating] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Une confirmation oubliee ne doit pas rester armee: elle retombe seule.
	useEffect(() => {
		if (!confirming) return;
		const timer = setTimeout(() => setConfirming(false), 4000);
		return () => clearTimeout(timer);
	}, [confirming]);

	async function duplicate() {
		setDuplicating(true);
		setError(null);
		try {
			await duplicateProfile(profile.id);
			await onRefresh();
			onDone();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Duplication impossible");
		} finally {
			setDuplicating(false);
		}
	}

	return (
		<footer className="flex flex-col gap-2 border-t border-divider px-5 py-4">
			{error && <p role="alert" className="m-0 text-[12.5px] text-danger">{error}</p>}
			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={duplicate}
					disabled={duplicating}
					className="flex items-center gap-2 rounded-md px-3 py-2 text-[13.5px] text-neutral-300 transition-colors hover:bg-well hover:text-ink disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					{duplicating ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
					Dupliquer
				</button>
				<button
					type="button"
					onClick={() => (confirming ? void onDelete() : setConfirming(true))}
					className={`ml-auto flex items-center gap-2 rounded-md px-3 py-2 text-[13.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger ${
						confirming ? "bg-danger-dim text-ink" : "text-danger hover:bg-danger-dim/40"
					}`}
				>
					<Trash2 className="size-4" />
					{confirming ? "Confirmer la suppression" : "Supprimer"}
				</button>
			</div>
		</footer>
	);
}

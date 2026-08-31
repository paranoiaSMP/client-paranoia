import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { migrateProfile } from "../../shared/api/profilesClient";
import { apiRequest } from "../../shared/api/http";
import { ArrowRight, Box, CheckCircle2, FileUp } from "lucide-react";

type DetectedProfile = {
	id: string;
	label: string;
	options_path: string;
	launcher: string;
};

const LAUNCHERS_UI: Record<string, { color: string; shortName: string }> = {
	"Lunar Client": {
		color: "bg-[#0b1016] border-[#1e2329]",
		shortName: "Lunar",
	},
	"Feather Client": {
		color: "bg-[#1f1f1f] border-[#333333]",
		shortName: "Feather",
	},
	Modrinth: { color: "bg-[#1bd96a] border-[#22c55e]", shortName: "Modrinth" },
	"CurseForge App": {
		color: "bg-[#f16436] border-[#f97316]",
		shortName: "CurseForge",
	},
	"Prism Launcher": {
		color: "bg-[#25252b] border-[#3f3f46]",
		shortName: "Prism Launcher",
	},
	GDLauncher: {
		color: "bg-[#0f172a] border-[#1e293b]",
		shortName: "GDLauncher",
	},
	ATLauncher: {
		color: "bg-[#18181b] border-[#27272a]",
		shortName: "ATLauncher",
	},
	MultiMC: { color: "bg-[#202020] border-[#303030]", shortName: "MultiMC" },
};

interface MigrationModalProps {
	onClose: () => void;
	onRefresh: () => void;
}

export function MigrationModal({ onClose, onRefresh }: MigrationModalProps) {
	const [detectedProfiles, setDetectedProfiles] = useState<DetectedProfile[]>(
		[],
	);
	const [selectedLauncher, setSelectedLauncher] = useState<string | null>(null);
	const [selectedProfileId, setSelectedProfileId] = useState<string | null>(
		null,
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		invoke<DetectedProfile[]>("get_detected_profiles")
			.then((res) => setDetectedProfiles(res))
			.catch((err) => console.error("Erreur de détection des profils :", err));
	}, []);

	const groupedProfiles = detectedProfiles.reduce(
		(acc, profile) => {
			const launcherList = acc[profile.launcher] || [];
			launcherList.push(profile);
			acc[profile.launcher] = launcherList;
			return acc;
		},
		{} as Record<string, DetectedProfile[]>,
	);

	const availableLaunchers = Object.keys(groupedProfiles);

	async function handleMigrate() {
		if (!selectedProfileId) return;
		const profile = detectedProfiles.find((p) => p.id === selectedProfileId);
		if (!profile) return;

		setLoading(true);
		setError(null);
		try {
			await migrateProfile({
				name: `Import de ${profile.launcher}`,
				minecraftVersion: "1.21.1",
				profileTypeId: "vanilla",
				graphicsModeId: "fancy",
				ramMb: 4096,
				resolution: "1920x1080",
				optionsTxtPath: profile.options_path,
			});
			onRefresh();
			onClose();
		} catch (e: any) {
			setError(e.message || "Erreur lors de la migration");
		} finally {
			setLoading(false);
		}
	}

	async function handleImportPack() {
		try {
			const file = await open({
				multiple: false,
				filters: [{ name: "Pack Lunar", extensions: ["lcpack"] }]
			});
			if (!file) return;

			setLoading(true);
			setError(null);

			await apiRequest("/v1/profiles/import-paths", {
				method: "POST",
				body: JSON.stringify({ paths: [file] }),
			});
			
			onRefresh();
			onClose();
		} catch (e: any) {
			setError(e.message || "Erreur lors de l'importation du pack");
		} finally {
			setLoading(false);
		}
	}

	if (selectedLauncher) {
		const profiles = groupedProfiles[selectedLauncher];
		if (!profiles) return null;
		return (
			<div className="p-6">
				<button
					onClick={() => setSelectedLauncher(null)}
					className="text-sm text-[#8888a0] hover:text-white mb-6 flex items-center gap-2"
				>
					← Retour aux launchers
				</button>
				<h3 className="text-xl text-white font-bold mb-6">
					Sélectionnez l'instance{" "}
					{LAUNCHERS_UI[selectedLauncher]?.shortName || selectedLauncher}
				</h3>

				<div className="grid grid-cols-1 gap-3 max-h-60 overflow-y-auto pr-2 mb-6">
					{profiles.map((p: DetectedProfile) => (
						<div
							key={p.id}
							onClick={() => setSelectedProfileId(p.id)}
							className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
								selectedProfileId === p.id
									? "bg-[#18181b] border-white/20"
									: "bg-[#0d0d0f] border-[#2a2a2c] hover:border-[#4a4a4c]"
							}`}
						>
							<div>
								<p className="text-white font-bold">
									{p.label.replace(selectedLauncher + " : ", "")}
								</p>
								<p className="text-xs text-[#8888a0] truncate w-64">
									{p.options_path}
								</p>
							</div>
							{selectedProfileId === p.id && (
								<CheckCircle2 className="text-white w-5 h-5" />
							)}
						</div>
					))}
				</div>

				{error && (
					<div className="p-3 mb-6 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
						{error}
					</div>
				)}

				<button
					onClick={handleMigrate}
					disabled={!selectedProfileId || loading}
					className="w-full py-3 bg-white hover:bg-gray-200 text-black font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2"
				>
					{loading ? "Migration en cours..." : "Migrer ce profil"}
					{!loading && <ArrowRight className="w-4 h-4" />}
				</button>
			</div>
		);
	}

	return (
		<div className="p-6 bg-[#111111] h-full flex flex-col justify-center relative">
			{loading && (
				<div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm rounded-xl">
					<div className="h-10 w-10 animate-spin rounded-full border-4 border-white border-t-transparent mb-4"></div>
					<p className="text-white font-bold">Importation en cours...</p>
				</div>
			)}
			
			<div className="text-center mb-8 mt-4">
				<h3 className="text-2xl text-white font-bold mb-2">
					Depuis d'autres launchers
				</h3>
				<p className="text-[#8888a0] max-w-sm mx-auto">
					Vous voulez changer ? Migrez vos profils existants en quelques
					secondes !
				</p>
			</div>

			<div className="grid grid-cols-2 md:grid-cols-3 gap-4 pb-8">
				{availableLaunchers.map((launcher) => {
					const ui = LAUNCHERS_UI[launcher] || {
						color: "bg-[#111111] border-[#2a2a2c]",
						shortName: launcher,
					};
					return (
						<button
							key={launcher}
							onClick={() => setSelectedLauncher(launcher)}
							className={`flex flex-col items-center justify-center p-6 rounded-2xl border-2 hover:-translate-y-1 transition-transform ${ui.color}`}
						>
							<Box className="w-8 h-8 text-white/80 mb-3" />
							<span className="text-white font-bold">{ui.shortName}</span>
						</button>
					);
				})}

				<button
					onClick={handleImportPack}
					className="flex flex-col items-center justify-center p-6 rounded-2xl border-2 hover:-translate-y-1 transition-transform bg-[#1a1621] border-[#9309ef]/50 hover:border-[#9309ef]"
				>
					<FileUp className="w-8 h-8 text-[#9309ef] mb-3" />
					<span className="text-white font-bold text-center">Pack Lunar<br/><span className="text-xs font-normal opacity-70">(.lcpack)</span></span>
				</button>
			</div>
			
			{error && (
				<div className="absolute bottom-4 left-6 right-6 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm text-center">
					{error}
				</div>
			)}
		</div>
	);
}

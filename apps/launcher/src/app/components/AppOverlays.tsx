import { useTranslation } from "react-i18next";
import type { LauncherProfile, MicrosoftAccount, RemoteConfiguration } from "@paranoia/contracts";

import type { useProfileCreation } from "../hooks/useProfileCreation";
import type { Overlay } from "../navigation";

import { Modal } from "./Modal";
import { ProfileCreation } from "./ProfileCreation";
import { BugReportModal } from "./BugReportModal";

type AppOverlaysProps = {
	active: Overlay;
	onClose: () => void;

	config: RemoteConfiguration | null;
	error: string | null;
	onClearError?: () => void;
	connected: boolean;

	mainProfile: LauncherProfile | null;
	running: boolean;

	creation: ReturnType<typeof useProfileCreation>;

	isDragging: boolean;
	isProcessing: boolean;

	account?: MicrosoftAccount | null | undefined;
	ramMaxMb?: number | null | undefined;
	launcherVersion?: string | undefined;
	bugReportData?: { category?: string | undefined; description?: string | undefined } | undefined;
};

/**
 * Ce qui s'ouvre par-dessus un ecran sans le remplacer.
 *
 * <p>Il n'en reste que deux qui meritent leur statut de fenetre: l'assistant
 * de creation, une tache qu'on mene jusqu'au bout ou qu'on abandonne, et le
 * signalement de bug. L'import et la fiche d'une instance sont des ecrans.
 */
export function AppOverlays({
	active,
	onClose,
	config,
	error,
	onClearError,
	connected,
	mainProfile,
	running,
	creation,
	isDragging,
	isProcessing,
	account,
	ramMaxMb,
	launcherVersion,
	bugReportData,
}: AppOverlaysProps) {
	const { t } = useTranslation();

	return (
		<>
			<Modal
				isOpen={active === "create_profile"}
				onClose={() => {
					onClose();
					creation.setIsCreating(false);
				}}
				title={t("home.add_instance", "Nouvelle instance")}
			>
				<ProfileCreation
					step={creation.step}
					setStep={creation.setStep}
					connected={connected}
					error={error}
					profileName={creation.profileName}
					setProfileName={creation.setProfileName}
					minecraftVersion={creation.minecraftVersion}
					setMinecraftVersion={creation.setMinecraftVersion}
					config={config}
					importSettings={creation.importSettings}
					setImportSettings={creation.setImportSettings}
					keybindSource={creation.keybindSource}
					setKeybindSource={creation.setKeybindSource}
					detectedProfiles={creation.detectedProfiles}
					importOptions={creation.importOptions}
					setImportOptions={creation.setImportOptions}
					profileType={creation.profileType}
					setProfileType={creation.setProfileType}
					graphicsMode={creation.graphicsMode}
					setGraphicsMode={creation.setGraphicsMode}
					selectedType={creation.selectedType}
					selectedGraphics={creation.selectedGraphics}
					handleInstall={creation.install}
					installState={running ? "running" : "idle"}
				/>
			</Modal>

			{isDragging && !isProcessing && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-accent/20 backdrop-blur-md">
					<div className="rounded-lg border-2 border-accent bg-surface px-8 py-6">
						<h2 className="text-2xl font-bold">
							Relâcher pour importer le profil
						</h2>
					</div>
				</div>
			)}

			{isProcessing && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-ground/70 backdrop-blur-md">
					<div className="flex flex-col items-center gap-4 rounded-lg border border-divider bg-surface px-8 py-6">
						<div className="size-12 animate-spin rounded-full border-4 border-accent border-t-transparent" />
						<h2 className="text-xl font-bold">Importation en cours...</h2>
					</div>
				</div>
			)}

			<BugReportModal
				isOpen={active === "report_bug"}
				onClose={onClose}
				account={account ?? null}
				profile={mainProfile}
				ramMaxMb={ramMaxMb}
				launcherVersion={launcherVersion}
				initialCategory={bugReportData?.category}
				initialDescription={bugReportData?.description}
			/>

			{/* Modal pour afficher les erreurs globales (ex: Ban) */}
			<Modal
				isOpen={!!error && active === "none" && !creation.isCreating}
				onClose={() => onClearError?.()}
				title="Erreur"
			>
				<div className="flex flex-col items-center p-6 gap-6 w-[400px]">
					<div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-500 ring-1 ring-red-500/30">
						<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
					</div>
					<div className="text-center">
						<h3 className="mb-2 text-xl font-bold text-ink">Action impossible</h3>
						<p className="text-sm text-neutral-300">{error}</p>
					</div>
					<button
						type="button"
						onClick={() => onClearError?.()}
						className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:ring-offset-surface"
					>
						Fermer
					</button>
				</div>
			</Modal>
		</>
	);
}

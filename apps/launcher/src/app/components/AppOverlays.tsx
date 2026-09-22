import { useTranslation } from "react-i18next";
import type { LauncherProfile, RemoteConfiguration } from "@paranoia/contracts";

import type { useProfileCreation } from "../hooks/useProfileCreation";
import type { Overlay } from "../navigation";

import { Modal } from "./Modal";
import { MigrationModal } from "./MigrationModal";
import { InstanceMenu } from "./InstanceMenu";
import { ProfileCreation } from "./ProfileCreation";

type AppOverlaysProps = {
	active: Overlay;
	onClose: () => void;

	config: RemoteConfiguration | null;
	error: string | null;
	connected: boolean;

	mainProfile: LauncherProfile | null;
	refreshProfiles: () => Promise<unknown>;
	onFavorite: (id: string) => void;
	onDelete: (id: string) => Promise<unknown>;
	onOpenMods: () => void;

	modCount: number | null;
	running: boolean;
	onPlay: (profile: LauncherProfile) => void;

	creation: ReturnType<typeof useProfileCreation>;

	isDragging: boolean;
	isProcessing: boolean;
};

/**
 * Ce qui s'ouvre par-dessus un ecran sans le remplacer.
 *
 * <p>Il en restait huit; il en reste trois. Les cinq autres -- mods, comptes,
 * parametres, journaux, profils -- etaient des destinations deguisees en
 * fenetres: on y allait pour y rester, et une fenetre qui ne se ferme jamais
 * est un ecran qui s'ignore. Elles sont passees dans la barre laterale.
 *
 * <p>Les trois qui restent meritent leur statut: l'assistant de creation et
 * l'import depuis un autre launcher sont des taches qu'on mene jusqu'au bout ou
 * qu'on abandonne, et la fiche d'instance est une aparte sur une ligne de la
 * liste.
 */
export function AppOverlays({
	active,
	onClose,
	config,
	error,
	connected,
	mainProfile,
	refreshProfiles,
	onFavorite,
	onDelete,
	onOpenMods,
	modCount,
	running,
	onPlay,
	creation,
	isDragging,
	isProcessing,
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

			<Modal isOpen={active === "migrate_profile"} onClose={onClose} title="">
				<MigrationModal onClose={onClose} onRefresh={refreshProfiles} />
			</Modal>

			<Modal
				isOpen={active === "instance" && !!mainProfile}
				onClose={onClose}
				title={mainProfile ? mainProfile.name : "Instance"}
			>
				{mainProfile && (
					<InstanceMenu
						profile={mainProfile}
						modCount={modCount}
						running={running}
						onPlay={() => {
							onClose();
							onPlay(mainProfile);
						}}
						onOpenMods={onOpenMods}
						onFavorite={() => onFavorite(mainProfile.id)}
						onDelete={async () => {
							await onDelete(mainProfile.id);
							onClose();
						}}
						onRefresh={refreshProfiles}
					/>
				)}
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
		</>
	);
}

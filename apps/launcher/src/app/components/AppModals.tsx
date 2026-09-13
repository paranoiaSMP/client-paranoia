import { useState } from "react";
import { useTranslation } from "react-i18next";
import type {
	LauncherProfile,
	MicrosoftAccount,
	RemoteConfiguration,
} from "@paranoia/contracts";

import { importProfile } from "../../shared/api/profilesClient";
import type { useProfileCreation } from "../hooks/useProfileCreation";
import type { ActiveModal } from "./HomeScreen";

import { Modal } from "./Modal";
import { MigrationModal } from "./MigrationModal";
import { InstanceMenu } from "./InstanceMenu";
import { ProfileCreation } from "./ProfileCreation";
import { Wardrobe } from "./Wardrobe";
import { ComptesTab } from "./tabs/ComptesTab";
import { LogsTab } from "./tabs/LogsTab";
import { ModsTab } from "./tabs/ModsTab";
import { ParametresTab } from "./tabs/ParametresTab";
import { ProfilsTab } from "./tabs/ProfilsTab";

type AppModalsProps = {
	active: ActiveModal;
	onOpen: (modal: ActiveModal) => void;
	onClose: () => void;

	config: RemoteConfiguration | null;
	error: string | null;
	setError: (message: string | null) => void;

	connected: boolean;
	account: MicrosoftAccount | null;
	accounts: MicrosoftAccount[];
	connectingMicrosoft: boolean;
	onConnectMicrosoft: () => void;
	onSwitchAccount: (account: MicrosoftAccount) => void;

	profiles: LauncherProfile[];
	mainProfile: LauncherProfile | null;
	/** Chaine vide tant qu'aucune instance n'a ete choisie, jamais null. */
	selectedProfileId: string;
	setSelectedProfileId: (id: string) => void;
	refreshProfiles: () => Promise<unknown>;
	onFavorite: (id: string) => void;
	onDelete: (id: string) => Promise<unknown>;

	modCount: number | null;
	running: boolean;
	onPlay: (profile: LauncherProfile) => void;

	creation: ReturnType<typeof useProfileCreation>;

	isDragging: boolean;
	isProcessing: boolean;
};

/**
 * Tout ce qui s'ouvre par-dessus l'accueil.
 *
 * <p>Les huit fenetres etaient empilees a la suite du rendu principal, dans le
 * meme fichier que l'accueil et que les dix-sept etats du composant racine.
 * Regroupees, elles rendent visible ce qu'elles ont en commun -- toutes se
 * ferment de la meme facon -- et laissent l'accueil se lire seul.
 *
 * <p>L'import par collage de JSON vit ici et non plus dans le composant
 * racine: il ne sert qu'a l'onglet Parametres.
 */
export function AppModals({
	active,
	onOpen,
	onClose,
	config,
	error,
	setError,
	connected,
	account,
	accounts,
	connectingMicrosoft,
	onConnectMicrosoft,
	onSwitchAccount,
	profiles,
	mainProfile,
	selectedProfileId,
	setSelectedProfileId,
	refreshProfiles,
	onFavorite,
	onDelete,
	modCount,
	running,
	onPlay,
	creation,
	isDragging,
	isProcessing,
}: AppModalsProps) {
	const { t } = useTranslation();
	const [importJson, setImportJson] = useState("");

	async function handleImportProfile() {
		try {
			const parsed = JSON.parse(importJson) as Partial<LauncherProfile>;
			if (
				!parsed.name ||
				!parsed.minecraftVersion ||
				!parsed.profileTypeId ||
				!parsed.graphicsModeId ||
				!parsed.ramMb ||
				!parsed.resolution
			) {
				throw new Error(t("settings.import_error"));
			}
			await importProfile({
				name: parsed.name,
				minecraftVersion: parsed.minecraftVersion,
				profileTypeId: parsed.profileTypeId,
				graphicsModeId: parsed.graphicsModeId,
				ramMb: parsed.ramMb,
				resolution: parsed.resolution,
			});
			setImportJson("");
			await refreshProfiles();
			onOpen("profils");
		} catch (e) {
			setError(
				e instanceof Error ? e.message : t("settings.import_format_error"),
			);
		}
	}

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
						onOpenMods={() => onOpen("mods")}
						onFavorite={() => onFavorite(mainProfile.id)}
						onDelete={async () => {
							await onDelete(mainProfile.id);
							onClose();
						}}
					/>
				)}
			</Modal>

			{/* Plein ecran plutot qu'une modale: un vestiaire montre une grille, un
			    casier et un apercu cote a cote, ce qu'une boite centree ne peut pas
			    porter sans devenir illisible. */}
			<Wardrobe
				open={active === "cosmetiques" || active === "boutique"}
				onClose={onClose}
			/>

			<Modal isOpen={active === "migrate_profile"} onClose={onClose} title="">
				<MigrationModal onClose={onClose} onRefresh={refreshProfiles} />
			</Modal>

			<Modal
				isOpen={active === "profils"}
				onClose={onClose}
				title="Gérer les profils"
			>
				<ProfilsTab
					profiles={profiles}
					selectedProfileId={selectedProfileId}
					setSelectedProfileId={setSelectedProfileId}
					isCreatingProfile={creation.isCreating}
					setIsCreatingProfile={creation.setIsCreating}
					onFavorite={onFavorite}
					onDelete={onDelete}
					onPlay={() => {
						onClose();
						if (mainProfile) onPlay(mainProfile);
					}}
					onMigrate={() => {
						onOpen("migrate_profile");
						creation.setIsCreating(false);
					}}
				/>
			</Modal>

			<Modal isOpen={active === "mods"} onClose={onClose} title="Mods">
				<ModsTab
					profiles={profiles}
					selectedProfileId={selectedProfileId}
					setSelectedProfileId={setSelectedProfileId}
					setError={setError}
				/>
			</Modal>

			<Modal isOpen={active === "comptes"} onClose={onClose} title="Comptes">
				<ComptesTab
					account={account}
					accounts={accounts}
					connectingMicrosoft={connectingMicrosoft}
					onConnectMicrosoft={onConnectMicrosoft}
					onSwitchAccount={onSwitchAccount}
				/>
			</Modal>

			<Modal
				isOpen={active === "parametres"}
				onClose={onClose}
				title="Paramètres"
			>
				<ParametresTab
					importJson={importJson}
					setImportJson={setImportJson}
					handleImportProfile={handleImportProfile}
					error={error}
				/>
			</Modal>

			<Modal isOpen={active === "logs"} onClose={onClose} title="Logs de jeu">
				<LogsTab />
			</Modal>

			{isDragging && !isProcessing && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-accent-purple/20 backdrop-blur-md">
					<div className="rounded-2xl border-2 border-accent-purple bg-panel px-8 py-6 shadow-2xl">
						<h2 className="text-2xl font-bold text-white">
							Relâcher pour importer le profil
						</h2>
					</div>
				</div>
			)}

			{isProcessing && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-md">
					<div className="flex flex-col items-center space-y-4 rounded-2xl border border-gray-800 bg-panel px-8 py-6 shadow-2xl">
						<div className="h-12 w-12 animate-spin rounded-full border-4 border-accent-purple border-t-transparent" />
						<h2 className="text-xl font-bold text-white">
							Importation en cours...
						</h2>
					</div>
				</div>
			)}
		</>
	);
}

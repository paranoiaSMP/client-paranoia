import type { CSSProperties } from "react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LauncherProfile } from "@paranoia/contracts";

import { UpdateModal } from "./components/UpdateModal";
import { AppModals } from "./components/AppModals";
import { HomeScreen } from "./components/HomeScreen";
import type { ActiveModal } from "./components/HomeScreen";
import {
	BootstrapErrorScreen,
	LoadingScreen,
	LoginScreen,
} from "./components/screens/StatusScreens";

import { useAuth } from "./hooks/useAuth";
import { useBootstrap } from "./hooks/useBootstrap";
import { useFileDrop } from "./hooks/useFileDrop";
import { useLaunch } from "./hooks/useLaunch";
import { useLobbyCape } from "./hooks/useLobbyCape";
import { useModCount } from "./hooks/useModCount";
import { useProfileCreation } from "./hooks/useProfileCreation";
import { useProfiles } from "./hooks/useProfiles";
import { useUpdater } from "./hooks/useUpdater";

/**
 * Fond de l'application.
 *
 * <p>Deux lueurs violettes tres diluees posees sur un degrade sombre: l'une en
 * haut a gauche derriere la barre d'actions, l'autre en bas a droite derriere
 * le personnage. Les valeurs restent basses volontairement -- le fond ne doit
 * pas concurrencer les vignettes, qui portent deja leur propre degrade.
 */
const BACKGROUND: CSSProperties = {
	backgroundImage: [
		// Les deux lueurs gagnent un peu, le fond descend beaucoup: c'est en
		// creusant l'ecart, et non en eclaircissant, qu'on obtient de la
		// profondeur. Eclaircir les lueurs seules aurait donne un fond delave.
		"radial-gradient(120% 85% at 12% 0%, rgba(147, 9, 239, 0.2) 0%, rgba(147, 9, 239, 0) 55%)",
		"radial-gradient(95% 75% at 100% 100%, rgba(97, 6, 158, 0.26) 0%, rgba(97, 6, 158, 0) 60%)",
		"linear-gradient(160deg, #120e20 0%, #0a0812 45%, #050409 100%)",
	].join(", "),
};

/**
 * Le composant racine: il cable, il ne dessine pas.
 *
 * <p>Il portait auparavant mille deux cents lignes -- vingt-cinq etats, cinq
 * effets, l'accueil entier et ses huit fenetres. Chaque retouche de mise en
 * page obligeait a traverser la mecanique de lancement, et chaque correction
 * de lancement a traverser la mise en page.
 *
 * <p>Ce qui reste ici est ce qui doit y rester: les branches entre les quatre
 * ecrans possibles, et le raccordement des morceaux entre eux. L'etat vit dans
 * des hooks nommes d'apres ce qu'ils font, le rendu dans des composants nommes
 * d'apres ce qu'ils montrent.
 */
export function App() {
	const { t } = useTranslation();

	const [error, setError] = useState<string | null>(null);
	const [activeModal, setActiveModal] = useState<ActiveModal>("none");

	const {
		connected,
		account,
		accounts,
		connectingMicrosoft,
		devModeAvailable,
		handleMicrosoftConnect,
		handleLocalDevContinue,
		handleSwitchAccount,
		handleLogout,
	} = useAuth(setError);

	const {
		state: updateState,
		install: installUpdate,
		dismiss: dismissUpdate,
	} = useUpdater();

	const {
		profiles,
		selectedProfileId,
		setSelectedProfileId,
		refreshProfiles,
		handleDeleteProfile,
		handleFavoriteProfile,
	} = useProfiles(setError);

	const { loading, failed, config, news, retry } = useBootstrap({
		refreshProfiles,
		setError,
		fallbackError: t("app.error_load"),
	});

	const { isDragging, isProcessing } = useFileDrop(refreshProfiles);

	// Le profil courant: celui qui est choisi, ou le premier a defaut. Le bouton
	// Jouer, le compteur de mods et le menu d'instance parlent tous de lui.
	const mainProfile =
		profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null;

	const { installState, status, launch, cancel } = useLaunch({
		profile: mainProfile,
		account,
		setError,
	});

	const modCount = useModCount(mainProfile, activeModal);
	const lobbyCape = useLobbyCape(activeModal === "cosmetiques");

	const creation = useProfileCreation({
		config,
		refreshProfiles,
		setError,
		onInstalled: () => setActiveModal("none"),
		fallbackError: t("wizard.install_fail"),
	});

	function openCreation() {
		creation.start(connected);
		setActiveModal("create_profile");
	}

	function play(profile: LauncherProfile) {
		setActiveModal("none");
		void launch(profile);
	}

	if (failed && !config) {
		return <BootstrapErrorScreen error={error} onRetry={retry} />;
	}

	if (loading || !config) {
		return <LoadingScreen />;
	}

	if (!connected) {
		return (
			<LoginScreen
				background={BACKGROUND}
				account={account}
				accounts={accounts}
				connectingMicrosoft={connectingMicrosoft}
				devModeAvailable={devModeAvailable}
				onConnectMicrosoft={handleMicrosoftConnect}
				onLocalDevContinue={handleLocalDevContinue}
				onSwitchAccount={handleSwitchAccount}
				onLogout={handleLogout}
			/>
		);
	}

	return (
		<div className="h-screen w-full flex overflow-hidden bg-void relative">
			<UpdateModal
				state={updateState}
				onInstall={installUpdate}
				onDismiss={dismissUpdate}
			/>

			<HomeScreen
				background={BACKGROUND}
				news={news}
				profiles={profiles}
				mainProfile={mainProfile}
				modCount={modCount}
				account={account}
				lobbyCape={lobbyCape}
				running={installState === "running"}
				progress={status.progress}
				onOpen={setActiveModal}
				onSelectProfile={setSelectedProfileId}
				onCreateProfile={openCreation}
				onPlay={() => mainProfile && play(mainProfile)}
				onStop={() => void cancel()}
				onLogout={handleLogout}
				onError={setError}
			/>

			<AppModals
				active={activeModal}
				onOpen={setActiveModal}
				onClose={() => setActiveModal("none")}
				config={config}
				error={error}
				setError={setError}
				connected={connected}
				account={account}
				accounts={accounts}
				connectingMicrosoft={connectingMicrosoft}
				onConnectMicrosoft={handleMicrosoftConnect}
				onSwitchAccount={handleSwitchAccount}
				profiles={profiles}
				mainProfile={mainProfile}
				selectedProfileId={selectedProfileId}
				setSelectedProfileId={setSelectedProfileId}
				refreshProfiles={refreshProfiles}
				onFavorite={handleFavoriteProfile}
				onDelete={handleDeleteProfile}
				modCount={modCount}
				running={installState === "running"}
				onPlay={play}
				creation={creation}
				isDragging={isDragging}
				isProcessing={isProcessing}
			/>
		</div>
	);
}

import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LauncherProfile } from "@paranoia/contracts";

import { UpdateModal } from "./components/UpdateModal";
import { AppOverlays } from "./components/AppOverlays";
import { Sidebar } from "./components/shell/Sidebar";
import { StatusBar } from "./components/shell/StatusBar";
import { TitleBar } from "./components/shell/TitleBar";
import { AccountsScreen } from "./components/screens/AccountsScreen";
import { CosmeticsScreen } from "./components/screens/CosmeticsScreen";
import { HomeScreen } from "./components/screens/HomeScreen";
import { LogsScreen } from "./components/screens/LogsScreen";
import { ModsScreen } from "./components/screens/ModsScreen";
import { SettingsScreen } from "./components/screens/SettingsScreen";
import { ShopScreen } from "./components/screens/ShopScreen";
import { VersionsScreen } from "./components/screens/VersionsScreen";
import {
	BootstrapErrorScreen,
	LoadingScreen,
	LoginScreen,
} from "./components/screens/StatusScreens";
import type { Overlay, Screen } from "./navigation";

import { useAppVersion } from "./hooks/useAppVersion";
import { useAuth } from "./hooks/useAuth";
import { useBootstrap } from "./hooks/useBootstrap";
import { useFileDrop } from "./hooks/useFileDrop";
import { useLaunch } from "./hooks/useLaunch";
import { useLobbyCape } from "./hooks/useLobbyCape";
import { useModCount } from "./hooks/useModCount";
import { useProfileCreation } from "./hooks/useProfileCreation";
import { useProfiles } from "./hooks/useProfiles";
import { useSettings } from "./hooks/useSettings";
import { useUpdater } from "./hooks/useUpdater";

/**
 * Le composant racine: il cable, il ne dessine pas.
 *
 * <p>Il choisit entre les quatre etats d'amorcage -- erreur, chargement,
 * connexion, application -- puis, dans le dernier, entre les huit destinations
 * de la barre laterale.
 *
 * <p>Ces destinations etaient des fenetres empilees par-dessus l'accueil, et
 * l'accueil portait leurs raccourcis replies derriere un carre. Elles sont
 * maintenant des ecrans que la barre laterale designe: l'accueil n'a plus a
 * savoir qu'elles existent, et elles n'ont plus a se dessiner par-dessus lui.
 */
export function App() {
	const { t } = useTranslation();

	const [error, setError] = useState<string | null>(null);
	const [screen, setScreen] = useState<Screen>("home");
	const [overlay, setOverlay] = useState<Overlay>("none");
	const [bugReportData, setBugReportData] = useState<
		{ category?: string | undefined; description?: string | undefined } | undefined
	>(undefined);
	const version = useAppVersion();

	const {
		connected,
		restoringSession,
		account,
		accounts,
		connectingMicrosoft,
		devModeAvailable,
		handleMicrosoftConnect,
		handleLocalDevContinue,
		handleSwitchAccount,
		handleLogout,
		handleDeleteAccount,
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

	const { settings, reload: reloadSettings } = useSettings();
	const { isDragging, isProcessing } = useFileDrop(refreshProfiles);

	// Le profil courant: celui qui est choisi, ou le premier a defaut. Le bouton
	// Jouer, le compteur de mods et la fiche d'instance parlent tous de lui.
	const mainProfile =
		profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null;

	const { installState, status, launch, cancel } = useLaunch({
		profile: mainProfile,
		account,
		setError,
	});

	const running = installState === "running";
	const modCount = useModCount(mainProfile, screen);
	const lobbyCape = useLobbyCape(screen === "cosmetics");

	const creation = useProfileCreation({
		config,
		refreshProfiles,
		setError,
		onInstalled: () => setOverlay("none"),
		fallbackError: t("wizard.install_fail"),
	});

	function openCreation() {
		creation.start(connected);
		setOverlay("create_profile");
	}

	function play(profile: LauncherProfile) {
		setOverlay("none");
		setScreen("home");
		void launch(profile);
	}

	if (failed && !config) {
		return <BootstrapErrorScreen error={error} onRetry={retry} />;
	}

	// `restoringSession` compte autant que `loading`. Il etait expose par
	// useAuth et personne ne le lisait: pendant que le jeton Microsoft se
	// renouvelait -- un aller-retour reseau jusqu'a login.live.com -- l'ecran
	// « Connexion requise » s'affichait a un joueur deja connecte, puis basculait
	// tout seul. On attendait donc devant un ecran qui disait le contraire de ce
	// qui se passait.
	if (loading || restoringSession || !config) {
		return <LoadingScreen />;
	}

	if (!connected) {
		return (
			<LoginScreen
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
		<div className="flex h-screen w-full flex-col overflow-hidden bg-ground">
			<TitleBar />

			<div className="flex min-h-0 flex-1">
				<Sidebar
					current={screen}
					onNavigate={setScreen}
					modCount={modCount}
					account={account}
					accounts={accounts}
					onSwitchAccount={handleSwitchAccount}
					onAddAccount={handleMicrosoftConnect}
				/>

				<main className="flex min-w-0 flex-1 flex-col">
					{screen === "home" && (
						<HomeScreen
							profile={mainProfile}
							modCount={modCount}
							account={account}
							lobbyCape={lobbyCape}
							running={running}
							status={status}
							news={news}
							onPlay={() => mainProfile && play(mainProfile)}
							onStop={() => void cancel()}
							onGoVersions={() => setScreen("versions")}
							onGoCosmetics={() => setScreen("cosmetics")}
							onReportBug={(initialData) => {
								setBugReportData(initialData);
								setOverlay("report_bug");
							}}
						/>
					)}

					{screen === "versions" && (
						<VersionsScreen
							profiles={profiles}
							selectedId={mainProfile?.id ?? null}
							onSelect={setSelectedProfileId}
							onOpenInstance={(id) => {
								setSelectedProfileId(id);
								setOverlay("instance");
							}}
							onCreate={openCreation}
							onMigrate={() => setOverlay("migrate_profile")}
						/>
					)}

					{screen === "mods" && (
						<ModsScreen
							profiles={profiles}
							selectedProfileId={selectedProfileId}
							setSelectedProfileId={setSelectedProfileId}
							modCount={modCount}
							setError={setError}
						/>
					)}

					{screen === "cosmetics" && <CosmeticsScreen />}
					{screen === "shop" && <ShopScreen />}

					{screen === "accounts" && (
						<AccountsScreen
							account={account}
							accounts={accounts}
							connecting={connectingMicrosoft}
							onConnect={handleMicrosoftConnect}
							onSwitch={handleSwitchAccount}
							onDeleteAccount={handleDeleteAccount}
						/>
					)}

					{screen === "settings" && (
						<SettingsScreen
							error={error}
							setError={setError}
							refreshProfiles={refreshProfiles}
							onSaved={reloadSettings}
							onLogout={handleLogout}
						/>
					)}

					{screen === "logs" && <LogsScreen />}
				</main>
			</div>

			<StatusBar
				ramMaxMb={settings?.ramMaxMb ?? null}
				instanceCount={profiles.length}
				version={version}
			/>

			<UpdateModal
				state={updateState}
				onInstall={installUpdate}
				onDismiss={dismissUpdate}
			/>

			<AppOverlays
				active={overlay}
				onClose={() => {
					setOverlay("none");
					setBugReportData(undefined);
				}}
				config={config}
				error={error}
				connected={connected}
				mainProfile={mainProfile}
				refreshProfiles={refreshProfiles}
				onFavorite={handleFavoriteProfile}
				onDelete={handleDeleteProfile}
				onOpenMods={() => {
					setOverlay("none");
					setScreen("mods");
				}}
				modCount={modCount}
				running={running}
				onPlay={play}
				creation={creation}
				isDragging={isDragging}
				isProcessing={isProcessing}
				account={account}
				ramMaxMb={settings?.ramMaxMb}
				launcherVersion={version}
				bugReportData={bugReportData}
			/>
		</div>
	);
}

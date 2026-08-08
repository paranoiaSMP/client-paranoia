import { useEffect, useMemo, useState } from "react";
import { invoke } from '@tauri-apps/api/core';
import { Pickaxe, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { RemoteConfiguration, NewsItem, LauncherProfile } from "@paranoia/contracts";

import { createInstallationManifest, fetchRemoteConfiguration } from "../shared/api/catalogClient";
import { createProfile, importProfile } from "../shared/api/profilesClient";
import { fetchNews } from "../shared/api/launcherInfoClient";
import { waitForApi } from "../shared/api/http";
import { launchMinecraftGame, getLaunchStatus, LaunchStatusResponse, stopMinecraftGame } from "../shared/api/launcherClient";

import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { AccueilTab } from "./components/tabs/AccueilTab";
import { ProfilsTab } from "./components/tabs/ProfilsTab";
import { ParametresTab } from "./components/tabs/ParametresTab";
import { ModsTab } from "./components/tabs/ModsTab";
import { ProfileCreation } from "./components/ProfileCreation";

import { UpdateBanner } from "./components/UpdateBanner";

import { useAuth } from "./hooks/useAuth";
import { useUpdater } from "./hooks/useUpdater";
import { useProfiles } from "./hooks/useProfiles";

type SetupStep = 1 | 2 | 3 | 4 | 5;

type DetectedProfile = {
  id: string;
  label: string;
  options_path: string;
  launcher: string;
};

export function App() {
  const { t } = useTranslation();
  
  // App Global State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<RemoteConfiguration | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [activeTab, setActiveTab] = useState<"accueil" | "profils" | "mods" | "parametres">("accueil");
  const [setupComplete, setSetupComplete] = useState(false);

  // Hooks
  const { connected, account, accounts, connectingMicrosoft, devModeAvailable, handleMicrosoftConnect, handleLocalDevContinue, handleSwitchAccount, handleLogout } = useAuth(setError);
  const { state: updateState, install: installUpdate, dismiss: dismissUpdate } = useUpdater();
  const { profiles, setProfiles, selectedProfileId, setSelectedProfileId, refreshProfiles, handleDeleteProfile, handleFavoriteProfile } = useProfiles(setError);

  // Profile Creation State
  const [step, setStep] = useState<SetupStep>(1);
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [minecraftVersion, setMinecraftVersion] = useState("1.21.1");
  const [profileType, setProfileType] = useState<string>("pvp");
  const [graphicsMode, setGraphicsMode] = useState<string>("performance");
  const [profileName, setProfileName] = useState("Mon profil");
  const [importSettings, setImportSettings] = useState(false);
  const [keybindSource, setKeybindSource] = useState("auto");
  const [detectedProfiles, setDetectedProfiles] = useState<DetectedProfile[]>([]);
  const [importOptions, setImportOptions] = useState({ keybinds: true, sensitivity: true, graphics: false });

  // Import State
  const [importJson, setImportJson] = useState("");

  // Game Launcher State
  const [installState, setInstallState] = useState<"idle" | "running" | "done">("idle");
  const [launchStatus, setLaunchStatus] = useState<LaunchStatusResponse>({ state: "idle", progress: 0, text: "" });

  // Poll launch status when installState is "running"
  // Poll launch status when installState is "running" or "done" (so we know when it stops)
  useEffect(() => {
    let interval: any;
    if ((installState === "running" || installState === "done") && selectedProfileId) {
      interval = setInterval(async () => {
        try {
          const status = await getLaunchStatus(selectedProfileId);
          setLaunchStatus(status);
          
          if (status.state === "error") {
            setError(status.text);
            setInstallState("idle");
            clearInterval(interval);
          } else if (status.state === "idle") {
            setInstallState("idle");
            clearInterval(interval);
          } else if (status.state === "running" && installState !== "done") {
            setInstallState("done");
          }
        } catch (e) {
        }
      }, 500);
    }
    return () => clearInterval(interval);
  }, [installState, selectedProfileId]);
  /*
   * DETECTION DES PROFILS EXTERNES
   * Recherche les installations existantes de Minecraft sur la machine pour l'importation de parametres.
   */
  useEffect(() => {
    if (importSettings && detectedProfiles.length === 0) {
      invoke<DetectedProfile[]>("get_detected_profiles")
        .then((res) => setDetectedProfiles(res))
        .catch((err) => console.error("Erreur de detection des profils :", err));
    }
  }, [importSettings, detectedProfiles.length]);

  /*
   * INITIALISATION DE L'APPLICATION
   * Charge la configuration distante, la liste des profils locaux et les dernieres actualites.
   */
  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError(null);
      setBootstrapFailed(false);
      try {
        await waitForApi();

        const [remoteConfig] = await Promise.all([
          fetchRemoteConfiguration(),
          refreshProfiles()
        ]);

        const latestNews = await fetchNews();
        setConfig(remoteConfig);
        const defaultMinecraftVersion = remoteConfig.supportedMinecraftVersions[0];
        if (defaultMinecraftVersion) {
          setMinecraftVersion(defaultMinecraftVersion);
        }

        const defaultProfileType = remoteConfig.profileTypes[0];
        if (defaultProfileType) {
          setProfileType(defaultProfileType.id);
        }

        const defaultGraphicsMode = remoteConfig.graphicsModes[0];
        if (defaultGraphicsMode) {
          setGraphicsMode(defaultGraphicsMode.id);
        }

        setNews(latestNews);
        setSetupComplete(true); // Assuming refreshProfiles updates the local state
      } catch (e) {
        setError(e instanceof Error ? e.message : t("app.error_load"));
        setBootstrapFailed(true);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootstrapAttempt]);

  const selectedType = useMemo(() => config?.profileTypes.find((x) => x.id === profileType), [config, profileType]);
  const selectedGraphics = useMemo(() => config?.graphicsModes.find((x) => x.id === graphicsMode), [config, graphicsMode]);

  /*
   * INSTALLATION D'UN NOUVEAU PROFIL
   * Genere le manifeste d'installation et cree l'entree du profil dans la base locale.
   */
  async function handleInstall() {
    try {
      setInstallState("running");
      setError(null);

      let selectedOptionsTxtPath = undefined;
      if (keybindSource !== "auto") {
        const found = detectedProfiles.find(p => p.id === keybindSource);
        if (found) {
          selectedOptionsTxtPath = found.options_path;
        }
      }

      await createInstallationManifest({
        minecraftVersion,
        profileTypeId: profileType,
        graphicsModeId: graphicsMode,
        locale: "fr-FR"
      });

      await createProfile({
        name: profileName,
        minecraftVersion,
        profileTypeId: profileType,
        graphicsModeId: graphicsMode,
        ramMb: 4096,
        resolution: "1920x1080",
        optionsTxtPath: selectedOptionsTxtPath
      });

      await refreshProfiles();
      setSetupComplete(true);
      setInstallState("done");
      setIsCreatingProfile(false);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("wizard.install_fail"));
      setInstallState("idle");
    }
  }

  /*
   * LANCEMENT DU JEU
   * Interagit avec le backend local pour telecharger les ressources manquantes et lancer le processus Java.
   */
  async function handleLaunchGame(profileId: string) {
    if (!account) return;
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    
    try {
      setInstallState("running");
      setLaunchStatus({ state: "idle", progress: 0, text: "Initialisation..." });
      await launchMinecraftGame(profileId, profile.minecraftVersion, profile.ramMb, account);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur au lancement du jeu");
      setInstallState("idle");
    }
  }

  /*
  *  ARRET DU JEU 
  *
  */
  
    async function handleStopGame(profileId: string) {
    try {
      await stopMinecraftGame(profileId);
      setInstallState("idle");
      setLaunchStatus({ state: "idle", progress: 0, text: "" });
    } catch (e) {
      console.error("Erreur lors de l'arrêt", e);
    }
  }
  
  

  /*
   * IMPORTATION D'UN PROFIL JSON
   */
  async function handleImportProfileAction() {
    try {
      const parsed = JSON.parse(importJson) as Partial<LauncherProfile>;
      if (!parsed.name || !parsed.minecraftVersion || !parsed.profileTypeId || !parsed.graphicsModeId || !parsed.ramMb || !parsed.resolution) {
        throw new Error(t("settings.import_error"));
      }
      await importProfile({
        name: parsed.name,
        minecraftVersion: parsed.minecraftVersion,
        profileTypeId: parsed.profileTypeId,
        graphicsModeId: parsed.graphicsModeId,
        ramMb: parsed.ramMb,
        resolution: parsed.resolution
      });
      setImportJson("");
      await refreshProfiles();
      setActiveTab("profils");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.import_format_error"));
    }
  }

  /*
   * ECHEC DE DEMARRAGE
   * Le service local n'a pas repondu. Sans cet ecran, `!config` gardait le
   * spinner affiche indefiniment et l'erreur calculee n'etait jamais montree.
   */
  if (bootstrapFailed && !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0f] p-8">
        <div className="max-w-md w-full text-center flex flex-col items-center gap-4">
          <AlertTriangle className="w-12 h-12 text-accent-red" strokeWidth={2} />
          <h1 className="text-white text-lg font-bold">
            {t("app.error_title")}
          </h1>
          <p className="text-[#a1a1aa] text-sm">{t("app.error_hint")}</p>
          {error && (
            <p className="text-[#71717a] text-xs font-mono bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 w-full break-words">
              {error}
            </p>
          )}
          <button
            onClick={() => setBootstrapAttempt((n) => n + 1)}
            className="mt-2 bg-accent-purple hover:bg-accent-purple-dark text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
          >
            {t("app.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (loading || !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0f]">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Pickaxe className="w-16 h-16 text-accent-purple-dark animate-bounce" strokeWidth={2.5} />
          <span className="text-white/60 tracking-widest text-sm uppercase font-outfit">{t("app.loading")}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex overflow-hidden">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 flex flex-col relative z-10 overflow-hidden bg-transparent">
        <UpdateBanner
          state={updateState}
          onInstall={installUpdate}
          onDismiss={dismissUpdate}
        />
        <TopBar 
          connected={connected} 
          account={account}
          accounts={accounts}
          connectingMicrosoft={connectingMicrosoft}
          devModeAvailable={devModeAvailable}
          onConnectMicrosoft={handleMicrosoftConnect}
          onLocalDevContinue={handleLocalDevContinue}
          onSwitchAccount={handleSwitchAccount}
          onLogout={handleLogout}
        />

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          {activeTab === "accueil" && (
            <AccueilTab 
              account={account}
              profiles={profiles}
              connected={connected}
              installState={installState}
              launchStatus={launchStatus}
              news={news}
              selectedProfileId={selectedProfileId}
              setSelectedProfileId={setSelectedProfileId}
              setActiveTab={setActiveTab}
              onStopGame={handleStopGame}
              onLaunchGame={handleLaunchGame}
            />
          )}

          {activeTab === "profils" && (
            <>
              {!isCreatingProfile ? (
                <ProfilsTab 
                  profiles={profiles}
                  selectedProfileId={selectedProfileId}
                  setSelectedProfileId={setSelectedProfileId}
                  isCreatingProfile={isCreatingProfile}
                  setIsCreatingProfile={setIsCreatingProfile}
                  onFavorite={handleFavoriteProfile}
                  onDelete={handleDeleteProfile}
                />
              ) : (
                <ProfileCreation 
                  step={step as number}
                  setStep={setStep as any}
                  connected={connected}
                  error={error}
                  profileName={profileName}
                  setProfileName={setProfileName}
                  minecraftVersion={minecraftVersion}
                  setMinecraftVersion={setMinecraftVersion}
                  config={config}
                  importSettings={importSettings}
                  setImportSettings={setImportSettings}
                  keybindSource={keybindSource}
                  setKeybindSource={setKeybindSource}
                  detectedProfiles={detectedProfiles}
                  importOptions={importOptions}
                  setImportOptions={setImportOptions}
                  profileType={profileType}
                  setProfileType={setProfileType}
                  graphicsMode={graphicsMode}
                  setGraphicsMode={setGraphicsMode}
                  selectedType={selectedType}
                  selectedGraphics={selectedGraphics}
                  handleInstall={handleInstall}
                  installState={installState}
                />
              )}
            </>
          )}

          {activeTab === "mods" && (
            <ModsTab
              profiles={profiles}
              selectedProfileId={selectedProfileId}
              setSelectedProfileId={setSelectedProfileId}
              setError={setError}
            />
          )}

          {activeTab === "parametres" && (
            <ParametresTab 
              importJson={importJson}
              setImportJson={setImportJson}
              handleImportProfile={handleImportProfileAction}
              error={error}
            />
          )}
        </div>
      </main>
    </div>
  );
}

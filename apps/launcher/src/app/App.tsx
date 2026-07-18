import { useEffect, useMemo, useState } from "react";
import { invoke } from '@tauri-apps/api/core';
import { Pickaxe } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { RemoteConfiguration, NewsItem } from "@paranoia/contracts";

import { createInstallationManifest, fetchRemoteConfiguration } from "../shared/api/catalogClient";
import { createProfile, importProfile } from "../shared/api/profilesClient";
import { fetchNews } from "../shared/api/launcherInfoClient";
import { launchMinecraftGame, getLaunchStatus, LaunchStatusResponse } from "../shared/api/launcherClient";

import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { AccueilTab } from "./components/tabs/AccueilTab";
import { ProfilsTab } from "./components/tabs/ProfilsTab";
import { ParametresTab } from "./components/tabs/ParametresTab";
import { ProfileCreation } from "./components/ProfileCreation";

import { useAuth } from "./hooks/useAuth";
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
  const [activeTab, setActiveTab] = useState<"accueil" | "profils" | "parametres">("accueil");
  const [setupComplete, setSetupComplete] = useState(false);

  // Hooks
  const { connected, account, accounts, connectingMicrosoft, handleMicrosoftConnect, handleLocalDevContinue, handleSwitchAccount, handleLogout } = useAuth(setError);
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
  useEffect(() => {
    let interval: any;
    if (installState === "running" && selectedProfileId) {
      interval = setInterval(async () => {
        try {
          const status = await getLaunchStatus(selectedProfileId);
          setLaunchStatus(status);
          if (status.state === "error") {
            setError(status.text);
            setInstallState("idle");
            clearInterval(interval);
          } else if (status.state === "running") {
            setInstallState("done");
            clearInterval(interval);
          }
        } catch (e) {
          // ignore
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
  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const [remoteConfig] = await Promise.all([
          fetchRemoteConfiguration(),
          refreshProfiles()
        ]);

        const latestNews = await fetchNews();
        setConfig(remoteConfig);
        
        if (remoteConfig.supportedMinecraftVersions.length > 0) {
          setMinecraftVersion(remoteConfig.supportedMinecraftVersions[0]);
        }
        if (remoteConfig.profileTypes.length > 0) {
          setProfileType(remoteConfig.profileTypes[0].id);
        }
        if (remoteConfig.graphicsModes.length > 0) {
          setGraphicsMode(remoteConfig.graphicsModes[0].id);
        }

        setNews(latestNews);
        setSetupComplete(true); // Assuming refreshProfiles updates the local state
      } catch (e) {
        setError(e instanceof Error ? e.message : t("app.error_load"));
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        resolution: "1920x1080"
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
        <TopBar 
          connected={connected} 
          account={account}
          accounts={accounts}
          connectingMicrosoft={connectingMicrosoft} 
          onConnectMicrosoft={handleMicrosoftConnect} 
          onLocalDevContinue={handleLocalDevContinue}
          onSwitchAccount={handleSwitchAccount}
          onLogout={handleLogout}
        />

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === "accueil" && (
            <AccueilTab 
              account={account}
              profiles={profiles}
              connected={connected}
              installState={installState}
              launchStatus={launchStatus}
              news={news}
              setSelectedProfileId={setSelectedProfileId}
              setActiveTab={setActiveTab}
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

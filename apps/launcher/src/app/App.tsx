import { useEffect, useMemo, useState } from "react";
import { invoke } from '@tauri-apps/api/core';
import { Pickaxe } from "lucide-react";
import { useTranslation } from "react-i18next";

import type {
  LauncherProfile,
  MicrosoftAccount,
  NewsItem,
  RemoteConfiguration
} from "@paranoia/contracts";

import { createInstallationManifest, fetchRemoteConfiguration } from "../shared/api/catalogClient";
import { createProfile, deleteProfile, favoriteProfile, importProfile, listProfiles } from "../shared/api/profilesClient";
import { completeMicrosoftCallback, getMicrosoftAuthorizeUrl } from "../shared/api/authClient";
import { fetchNews } from "../shared/api/launcherInfoClient";

import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { AccueilTab } from "./components/tabs/AccueilTab";
import { ProfilsTab } from "./components/tabs/ProfilsTab";
import { ParametresTab } from "./components/tabs/ParametresTab";
import { ProfileCreation } from "./components/ProfileCreation";

type SetupStep = 1 | 2 | 3 | 4 | 5;

type DetectedProfile = {
  id: string;
  label: string;
  options_path: string;
  launcher: string;
};

export function App() {
  const { t } = useTranslation();
  const [step, setStep] = useState<SetupStep>(1);
  const [connected, setConnected] = useState(false);
  const [config, setConfig] = useState<RemoteConfiguration | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [minecraftVersion, setMinecraftVersion] = useState("1.21.11");
  const [profileType, setProfileType] = useState<string>("pvp");
  const [graphicsMode, setGraphicsMode] = useState<string>("performance");
  const [profileName, setProfileName] = useState("Mon profil");
  const [setupComplete, setSetupComplete] = useState(false);
  const [profiles, setProfiles] = useState<LauncherProfile[]>([]);
  const [installState, setInstallState] = useState<"idle" | "running" | "done">("idle");
  const [account, setAccount] = useState<MicrosoftAccount | null>(null);
  const [connectingMicrosoft, setConnectingMicrosoft] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [importJson, setImportJson] = useState("");
  const [activeTab, setActiveTab] = useState<"accueil" | "profils" | "parametres">("accueil");
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const [isCreatingProfile, setIsCreatingProfile] = useState(false);
  const [importSettings, setImportSettings] = useState(false);
  const [keybindSource, setKeybindSource] = useState("auto");
  const [detectedProfiles, setDetectedProfiles] = useState<DetectedProfile[]>([]);
  const [importOptions, setImportOptions] = useState({
    keybinds: true,
    sensitivity: true,
    graphics: false
  });

  useEffect(() => {
    if (importSettings && detectedProfiles.length === 0) {
      invoke<DetectedProfile[]>("get_detected_profiles")
        .then((res) => {
          setDetectedProfiles(res);
        })
        .catch((err) => console.error("Erreur de détection des profils :", err));
    }
  }, [importSettings, detectedProfiles.length]);

  useEffect(() => {
    if (profiles.length > 0 && !selectedProfileId) {
      const p = profiles[0];
      if (p) setSelectedProfileId(p.id);
    }
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError(null);
      try {
        const [remoteConfig, existingProfiles] = await Promise.all([
          fetchRemoteConfiguration(),
          listProfiles()
        ]);

        const latestNews = await fetchNews();

        setConfig(remoteConfig);
        const firstVersion = remoteConfig.supportedMinecraftVersions[0];
        if (firstVersion) setMinecraftVersion(firstVersion);

        const firstProfileType = remoteConfig.profileTypes[0];
        if (firstProfileType) setProfileType(firstProfileType.id);

        const firstGraphicsMode = remoteConfig.graphicsModes[0];
        if (firstGraphicsMode) setGraphicsMode(firstGraphicsMode.id);

        setProfiles(existingProfiles);
        setSetupComplete(existingProfiles.length > 0);
        setNews(latestNews);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("app.error_load"));
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  useEffect(() => {
    async function tryHandleAuthCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");

      if (!code || !state) return;

      try {
        setConnectingMicrosoft(true);
        setError(null);
        const redirectUri = `${window.location.origin}/auth/callback`;
        const authAccount = await completeMicrosoftCallback({ code, state, redirectUri });
        setAccount(authAccount);
        setConnected(true);
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("topbar.auth_error"));
      } finally {
        setConnectingMicrosoft(false);
      }
    }
    tryHandleAuthCallback();
  }, []);

  async function handleMicrosoftConnect() {
    try {
      setConnectingMicrosoft(true);
      setError(null);
      const redirectUri = `${window.location.origin}/auth/callback`;
      const { authorizeUrl } = await getMicrosoftAuthorizeUrl(redirectUri);
      window.location.assign(authorizeUrl);
    } catch (e) {
      setConnectingMicrosoft(false);
      setError(e instanceof Error ? e.message : t("topbar.auth_launch_error"));
    }
  }

  function handleLocalDevContinue() {
    setConnected(true);
    setAccount({
      id: "local-dev",
      minecraftUuid: "00000000000000000000000000000000",
      minecraftUsername: "DEV",
      skinUrl: "",
      accessToken: "local-dev-token",
      refreshToken: "local-dev-refresh",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    });
  }

  const selectedType = useMemo(() => config?.profileTypes.find((x) => x.id === profileType), [config, profileType]);
  const selectedGraphics = useMemo(() => config?.graphicsModes.find((x) => x.id === graphicsMode), [config, graphicsMode]);

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

      const refreshedProfiles = await listProfiles();
      setProfiles(refreshedProfiles);
      setSetupComplete(true);
      setInstallState("done");
      setIsCreatingProfile(false);
      setStep(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("wizard.install_fail"));
      setInstallState("idle");
    }
  }

  async function handleDeleteProfile(profileId: string) {
    await deleteProfile(profileId);
    setProfiles(await listProfiles());
  }

  async function handleFavoriteProfile(profileId: string) {
    await favoriteProfile(profileId);
    setProfiles(await listProfiles());
  }

  async function handleImportProfile() {
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
      setProfiles(await listProfiles());
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
          connectingMicrosoft={connectingMicrosoft} 
          onConnectMicrosoft={handleMicrosoftConnect} 
          onLocalDevContinue={handleLocalDevContinue} 
        />

        <div className="flex-1 overflow-y-auto p-8">
          {activeTab === "accueil" && (
            <AccueilTab 
              account={account}
              profiles={profiles}
              connected={connected}
              installState={installState}
              news={news}
              setSelectedProfileId={setSelectedProfileId}
              setActiveTab={setActiveTab}
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
              handleImportProfile={handleImportProfile}
              error={error}
            />
          )}
        </div>
      </main>
    </div>
  );
}

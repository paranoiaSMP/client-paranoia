import { useEffect, useMemo, useState, useRef, useLayoutEffect } from "react";
import { invoke } from '@tauri-apps/api/core';
import { Play, Settings, Plus, Box, Pickaxe, Server, LogOut, Menu, X, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";

import { SkinViewer3D } from "../components/SkinViewer3D";

import type { RemoteConfiguration, NewsItem, LauncherProfile } from "@paranoia/contracts";

import { createInstallationManifest, fetchRemoteConfiguration } from "../shared/api/catalogClient";
import { createProfile, importProfile } from "../shared/api/profilesClient";
import { fetchNews } from "../shared/api/launcherInfoClient";
import { waitForApi } from "../shared/api/http";
import { launchMinecraftGame, getLaunchStatus, LaunchStatusResponse, cancelLaunch } from "../shared/api/launcherClient";

import { TopBar } from "./components/TopBar";
import { ProfilsTab } from "./components/tabs/ProfilsTab";
import { ParametresTab } from "./components/tabs/ParametresTab";
import { ModsTab } from "./components/tabs/ModsTab";
import { ProfileCreation } from "./components/ProfileCreation";
import { Modal } from "./components/Modal";
import { UpdateBanner } from "./components/UpdateBanner";

import { useAuth } from "./hooks/useAuth";
import { useUpdater } from "./hooks/useUpdater";
import { useProfiles } from "./hooks/useProfiles";

const DESIGN_WIDTH = 860;
const DESIGN_HEIGHT = 520;

const SETTINGS_HEIGHTS = [
  57, 57, 65, 77, 82, 95, 111, 144, 192, 245, 326, 352, 387, 401, 424,
  448, 474, 504, 504,
];

const SETTINGS_TIMES = [
  0, 0.0075, 0.0385, 0.0636, 0.0861, 0.1098, 0.137, 0.1662, 0.2006,
  0.2314, 0.2638, 0.2926, 0.3226, 0.3432, 0.3691, 0.3961, 0.4267,
  0.459, 1,
];

type SetupStep = 1 | 2 | 3 | 4 | 5;

type DetectedProfile = {
  id: string;
  name: string;
  options_path: string;
  launcher: string;
};

function InstanceCard({ label, isSelected, onClick }: { label: string, isSelected: boolean, onClick: () => void }) {
  return (
    <article
      onClick={onClick}
      className={`relative flex h-[180px] w-[184px] shrink-0 cursor-pointer items-end overflow-hidden rounded-[18px] border-2 transition-colors ${
        isSelected ? "border-[#9309ef] bg-[#2a133f]" : "border-[#333] bg-[#212121] hover:border-[#555]"
      } p-4`}
    >
      <p className="whitespace-nowrap text-sm font-medium leading-normal text-white truncate w-full">
        {label}
      </p>
    </article>
  );
}

export function App() {
  const { t } = useTranslation();
  
  // App Global State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<RemoteConfiguration | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [setupComplete, setSetupComplete] = useState(false);

  // Layout State (Modals)
  const [activeModal, setActiveModal] = useState<"none" | "profils" | "create_profile" | "mods" | "parametres">("none");
  const [menuOpen, setMenuOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

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

  const mainProfile = profiles.find((p) => p.id === selectedProfileId) || (profiles.length > 0 ? profiles[0] : null);

  // Polling for launch status of the currently selected profile
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    
    if (mainProfile) {
      const checkStatus = async () => {
        try {
          const status = await getLaunchStatus(mainProfile.id);
          setLaunchStatus(status);
          
          setInstallState(prev => {
            if (status.state === "error" && prev === "running") {
              setError(status.text);
              return "idle";
            }
            if (status.state === "idle" && prev === "running") {
              return "idle";
            }
            if (status.state !== "idle" && status.state !== "error" && prev === "idle") {
              return "running";
            }
            return prev;
          });
        } catch (e) {
          console.error(e);
        }
      };

      // Fetch immediately on profile change
      checkStatus();
      
      // Poll every second
      intervalId = setInterval(checkStatus, 1000);
    }
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [mainProfile]);

  useEffect(() => {
    if (importSettings && detectedProfiles.length === 0) {
      invoke<DetectedProfile[]>("get_detected_profiles")
        .then((res) => setDetectedProfiles(res))
        .catch((err) => console.error("Erreur de detection des profils :", err));
    }
  }, [importSettings, detectedProfiles.length]);

  const [bootstrapFailed, setBootstrapFailed] = useState(false);
  const [bootstrapAttempt, setBootstrapAttempt] = useState(0);

  useEffect(() => {
    async function bootstrap() {
      setLoading(true);
      setError(null);
      setBootstrapFailed(false);
      try {
        await waitForApi();
        const [remoteConfig] = await Promise.all([fetchRemoteConfiguration(), refreshProfiles()]);
        const latestNews = await fetchNews();
        setConfig(remoteConfig);
        const defaultMinecraftVersion = remoteConfig.supportedMinecraftVersions[0];
        if (defaultMinecraftVersion) setMinecraftVersion(defaultMinecraftVersion);
        const defaultProfileType = remoteConfig.profileTypes[0];
        if (defaultProfileType) setProfileType(defaultProfileType.id);
        const defaultGraphicsMode = remoteConfig.graphicsModes[0];
        if (defaultGraphicsMode) setGraphicsMode(defaultGraphicsMode.id);
        setNews(latestNews);
        setSetupComplete(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : t("app.error_load"));
        setBootstrapFailed(true);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, [bootstrapAttempt]);

  const selectedType = useMemo(() => config?.profileTypes.find((x) => x.id === profileType), [config, profileType]);
  const selectedGraphics = useMemo(() => config?.graphicsModes.find((x) => x.id === graphicsMode), [config, graphicsMode]);

  async function handleInstall() {
    try {
      setInstallState("running");
      setError(null);
      let selectedOptionsTxtPath = undefined;
      if (keybindSource === "auto" && detectedProfiles.length > 0) {
        selectedOptionsTxtPath = detectedProfiles[0]?.options_path;
      } else if (keybindSource !== "auto") {
        const found = detectedProfiles.find(p => p.id === keybindSource);
        if (found) selectedOptionsTxtPath = found.options_path;
      }
      await createInstallationManifest({ minecraftVersion, profileTypeId: profileType, graphicsModeId: graphicsMode, locale: "fr-FR" });
      await createProfile({ name: profileName, minecraftVersion, profileTypeId: profileType, graphicsModeId: graphicsMode, ramMb: 4096, resolution: "1920x1080", optionsTxtPath: selectedOptionsTxtPath });
      await refreshProfiles();
      setSetupComplete(true);
      setInstallState("done");
      setIsCreatingProfile(false);
      setStep(1);
      setActiveModal("none");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("wizard.install_fail"));
      setInstallState("idle");
    }
  }

  async function handleLaunchGame(profileId: string) {
    if (!account) return;
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    setActiveModal("none");
    try {
      setInstallState("running");
      setLaunchStatus({ state: "idle", progress: 0, text: "Initialisation..." });
      await launchMinecraftGame(profileId, profile.minecraftVersion, profile.ramMb, account);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur au lancement du jeu");
      setInstallState("idle");
    }
  }

  const handleCancelLaunch = async () => {
    if (!mainProfile) return;
    try {
      await cancelLaunch(mainProfile.id);
      setInstallState("idle");
      setLaunchStatus({ state: "idle", progress: 0, text: "" });
    } catch (e) {
      console.error(e);
    }
  };

  async function handleImportProfileAction() {
    try {
      const parsed = JSON.parse(importJson) as Partial<LauncherProfile>;
      if (!parsed.name || !parsed.minecraftVersion || !parsed.profileTypeId || !parsed.graphicsModeId || !parsed.ramMb || !parsed.resolution) {
        throw new Error(t("settings.import_error"));
      }
      await importProfile({ name: parsed.name, minecraftVersion: parsed.minecraftVersion, profileTypeId: parsed.profileTypeId, graphicsModeId: parsed.graphicsModeId, ramMb: parsed.ramMb, resolution: parsed.resolution });
      setImportJson("");
      await refreshProfiles();
      setActiveModal("profils");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("settings.import_format_error"));
    }
  }

  if (bootstrapFailed && !config) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0d0f] p-8">
        <div className="max-w-md w-full text-center flex flex-col items-center gap-4">
          <AlertTriangle className="w-12 h-12 text-accent-red" strokeWidth={2} />
          <h1 className="text-white text-lg font-bold">{t("app.error_title")}</h1>
          <p className="text-[#a1a1aa] text-sm">{t("app.error_hint")}</p>
          {error && <p className="text-[#71717a] text-xs font-mono bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2 w-full break-words">{error}</p>}
          <button onClick={() => setBootstrapAttempt((n) => n + 1)} className="mt-2 bg-accent-purple hover:bg-accent-purple-dark text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors">{t("app.retry")}</button>
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

  // IF DISCONNECTED -> KEEP TOPBAR LAYOUT FOR LOGIN
  if (!connected) {
    return (
      <div className="h-screen w-full flex flex-col overflow-hidden bg-[#0b0b0b]">
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
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-white">Connexion requise</h2>
            <p className="text-gray-400">Veuillez vous connecter pour accéder au launcher.</p>
          </div>
        </div>
      </div>
    );
  }

  // GAME UI LAYOUT
  const displayProfiles = [0, 1, 2].map((index) => profiles[index] || null);

  return (
    <div className="h-screen w-full flex overflow-hidden bg-[#0b0b0b] relative">
      <UpdateBanner state={updateState} onInstall={installUpdate} onDismiss={dismissUpdate} />
      
      <main className="flex-1 flex items-center justify-center min-h-[520px]">
        <div className="w-full h-full relative">
          <section
            aria-label="Interface principale du jeu"
            className="absolute inset-0 w-full h-full overflow-hidden bg-[#141414] p-8 lg:p-12 flex flex-col"
          >
            {/* EN-TÊTE / HEADER BLOCK & SLIDE INDICATORS */}
            <div className="flex flex-col gap-5">
              <div className="h-[99px] w-full lg:w-[75%] overflow-hidden rounded-[20px] bg-[#262626] shrink-0" />
              <img
                alt=""
                aria-hidden="true"
                className="h-2 w-[104px] ml-6"
                src="/assets/slide-indicators.svg"
              />
            </div>


            {/* SLIDING MENU */}
            <motion.div
              aria-hidden="true"
              {...(prefersReducedMotion ? {} : { animate: { height: menuOpen ? 420 : 56 } })}
              className="absolute right-[32px] top-[32px] z-20 w-14 overflow-hidden rounded-[14px] border border-[#333] bg-[#212121] flex flex-col"
              initial={false}
              transition={{
                height: { duration: 0.3, ease: "easeInOut" },
              }}
            >
              {/* TOP HEADER - Toujours visible et parfaitement centré */}
              <div className="h-[54px] w-full shrink-0 flex items-center justify-center">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="w-10 h-10 shrink-0 flex items-center justify-center rounded-[10px] hover:bg-[#333] transition-colors group"
                >
                  {menuOpen ? (
                    <X className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
                  ) : (
                    <Menu className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
                  )}
                </button>
              </div>

                {menuOpen && (
                  <motion.div 
                    initial={{ opacity: 0 }} 
                    animate={{ opacity: 1 }} 
                    className="flex flex-col items-center flex-1 w-full mt-4 pb-4"
                  >
                    <div className="flex flex-col items-center gap-4">
                      <button onClick={() => { setActiveModal("profils"); setMenuOpen(false); }} className="w-10 h-10 flex items-center justify-center rounded-[10px] hover:bg-[#333] transition-colors group relative" title="Gérer les profils">
                        <Box className="w-5 h-5 text-gray-400 group-hover:text-white" />
                      </button>
                      <button onClick={() => { setActiveModal("mods"); setMenuOpen(false); }} className="w-10 h-10 flex items-center justify-center rounded-[10px] hover:bg-[#333] transition-colors group relative" title="Mods">
                        <Pickaxe className="w-5 h-5 text-gray-400 group-hover:text-white" />
                      </button>
                      <button onClick={() => { setActiveModal("parametres"); setMenuOpen(false); }} className="w-10 h-10 flex items-center justify-center rounded-[10px] hover:bg-[#333] transition-colors group relative" title="Paramètres">
                        <Settings className="w-5 h-5 text-gray-400 group-hover:text-white" />
                      </button>
                    </div>

                    <div className="flex flex-col items-center mt-auto gap-4">
                      <div className="w-6 h-[1px] bg-[#333]" />
                      <button onClick={() => { handleLogout(); setMenuOpen(false); }} className="w-10 h-10 flex items-center justify-center rounded-[10px] hover:bg-red-500/20 transition-colors group relative" title="Déconnexion">
                        <LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
                      </button>
                    </div>
                  </motion.div>
                )}
            </motion.div>

            {/* PROFILES & PLAY BUTTON */}
            <div className="mt-auto flex flex-col items-start gap-8 pb-4 relative z-10 w-full lg:w-[55%] xl:w-[50%] lg:pr-8">
              <div className="flex flex-row items-center gap-8 flex-wrap">
                {displayProfiles.map((profile, index) => {
                  const isSelected = profile ? profile.id === mainProfile?.id : false;
                  const label = profile ? profile.name : t("home.new_instance", "Nouvelle instance");
                  return (
                    <InstanceCard
                      key={index}
                      label={label}
                      isSelected={isSelected}
                      onClick={() => {
                        if (profile) {
                          setSelectedProfileId(profile.id);
                        } else {
                          setStep(connected ? 2 : 1);
                          setIsCreatingProfile(true);
                          setActiveModal("create_profile");
                        }
                      }}
                    />
                  );
                })}

                <button
                  aria-label="Ajouter une instance"
                  className="grid size-20 shrink-0 place-items-center rounded-2xl bg-[#1e1e1e] hover:bg-[#2a2a2a] transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9309ef]"
                  onClick={() => {
                    setStep(connected ? 2 : 1);
                    setIsCreatingProfile(true);
                    setActiveModal("create_profile");
                  }}
                  type="button"
                >
                  <img
                    alt=""
                    aria-hidden="true"
                    className="size-10"
                    src="/assets/plus-square.svg"
                  />
                </button>
              </div>

              <div className="flex h-[74px] w-[280px] shrink-0 items-center">
                <button
                  aria-label={installState === "running" ? "Arrêter" : "Lancer"}
                  disabled={!mainProfile}
                  className={`flex h-[61px] w-full px-6 relative items-center justify-center overflow-hidden rounded-[10px] text-sm font-normal text-white transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:opacity-50 disabled:cursor-not-allowed ${installState === "running" ? "bg-red-600 focus-visible:outline-red-500" : "bg-[#61069e] focus-visible:outline-[#9309ef]"}`}
                  onClick={() => {
                    if (!mainProfile) return;
                    if (installState === "running") {
                      handleCancelLaunch();
                    } else {
                      handleLaunchGame(mainProfile.id);
                    }
                  }}
                  type="button"
                >
                  {installState === "running" && launchStatus && (
                    <div className="absolute inset-0 bg-red-800" style={{ width: `${launchStatus.progress * 100}%` }} />
                  )}
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {installState === "running" ? (
                      <>
                        <X className="w-5 h-5 fill-current" />
                        {t("home.stop", "Arrêter")}
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current" />
                        {t("home.play", "Jouer")}
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* PERSONNAGE 3D */}
            <div className="absolute right-0 bottom-0 pointer-events-none hidden lg:flex h-full w-[45%] xl:w-[50%] justify-center items-end pb-4">
              <div className="pointer-events-auto w-full max-w-[550px] h-[85%] max-h-[850px]">
                <SkinViewer3D 
                  className="w-full h-full"
                  skinUrl={account?.minecraftUsername ? `https://minotar.net/skin/${account.minecraftUsername}` : "https://minotar.net/skin/Steve"} 
                  paused={installState === "running"}
                />
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* MODALS */}
      <Modal isOpen={activeModal === "create_profile"} onClose={() => { setActiveModal("none"); setIsCreatingProfile(false); }} title={t("home.add_instance", "Nouvelle instance")}>
        <ProfileCreation 
          step={step as number} setStep={setStep as any} connected={connected} error={error}
          profileName={profileName} setProfileName={setProfileName} minecraftVersion={minecraftVersion}
          setMinecraftVersion={setMinecraftVersion} config={config} importSettings={importSettings}
          setImportSettings={setImportSettings} keybindSource={keybindSource} setKeybindSource={setKeybindSource}
          detectedProfiles={detectedProfiles} importOptions={importOptions} setImportOptions={setImportOptions}
          profileType={profileType} setProfileType={setProfileType} graphicsMode={graphicsMode}
          setGraphicsMode={setGraphicsMode} selectedType={selectedType} selectedGraphics={selectedGraphics}
          handleInstall={handleInstall} installState={installState}
        />
      </Modal>

      <Modal isOpen={activeModal === "profils"} onClose={() => setActiveModal("none")} title="Gérer les profils">
        <ProfilsTab 
          profiles={profiles} selectedProfileId={selectedProfileId} setSelectedProfileId={setSelectedProfileId}
          isCreatingProfile={isCreatingProfile} setIsCreatingProfile={setIsCreatingProfile} onFavorite={handleFavoriteProfile}
          onDelete={handleDeleteProfile} onPlay={handleLaunchGame}
        />
      </Modal>

      <Modal isOpen={activeModal === "mods"} onClose={() => setActiveModal("none")} title="Mods">
        <ModsTab profiles={profiles} selectedProfileId={selectedProfileId} setSelectedProfileId={setSelectedProfileId} setError={setError} />
      </Modal>

      <Modal isOpen={activeModal === "parametres"} onClose={() => setActiveModal("none")} title="Paramètres">
        <ParametresTab importJson={importJson} setImportJson={setImportJson} handleImportProfile={handleImportProfileAction} error={error} />
      </Modal>
    </div>
  );
}

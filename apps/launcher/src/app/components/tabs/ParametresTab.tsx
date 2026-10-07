import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Coffee,
  Cpu,
  Download,
  FileJson,
  Globe,
  Layers,
  Loader2,
  Monitor,
  RotateCcw,
  Search,
  Sliders,
  Terminal,
  Upload,
} from "lucide-react";
import {
  fetchSettings,
  saveSettings,
  type LauncherSettings,
} from "../../../shared/api/settingsClient";
import {
  detecterJava as demandeLesJava,
  installerJava,
  type JavaTrouve,
} from "../../../shared/api/launcherClient";

type ParametresTabProps = {
  importJson: string;
  setImportJson: (json: string) => void;
  handleImportProfile: () => void;
  error: string | null;
  /** Rappelé après un enregistrement réussi pour synchroniser le bandeau global. */
  onSaved?: () => void;
};

type SettingsSection =
  | "java"
  | "ram"
  | "window"
  | "behavior"
  | "language"
  | "import"
  | "all";

type RAMPreset = {
  label: string;
  min: number;
  max: number;
  description: string;
};

const RAM_PRESETS: RAMPreset[] = [
  { label: "Léger", min: 2, max: 4, description: "Configuration standard (Vanilla / OptiFine)" },
  { label: "Modpacks", min: 3, max: 6, description: "Recommandé pour la majorité des mods" },
  { label: "Performance", min: 4, max: 8, description: "Packs volumineux et shaders actifs" },
  { label: "Haute capacité", min: 6, max: 12, description: "Gros modpacks techniques" },
];

const RESOLUTION_PRESETS = [
  { label: "720p HD", width: 1280, height: 720 },
  { label: "900p HD+", width: 1600, height: 900 },
  { label: "1080p FHD", width: 1920, height: 1080 },
];

type ManagedJavaTarget = {
  major: number;
  title: string;
  versionName: string;
  description: string;
  tag: string;
};

const MANAGED_JAVA_TARGETS: ManagedJavaTarget[] = [
  {
    major: 8,
    title: "Java 8",
    versionName: "Temurin OpenJDK 8",
    description: "Requis pour Minecraft 1.16.5 et toutes les versions antérieures (1.12.2, 1.8.9, 1.7.10...)",
    tag: "Anciennes versions",
  },
  {
    major: 17,
    title: "Java 17",
    versionName: "Temurin OpenJDK 17",
    description: "Requis pour Minecraft 1.17 jusqu'à 1.20.4",
    tag: "Versions intermédiaires",
  },
  {
    major: 21,
    title: "Java 21",
    versionName: "Temurin OpenJDK 21",
    description: "Requis pour Minecraft 1.20.5+ et les versions récentes (1.21+)",
    tag: "Versions récentes",
  },
  {
    major: 25,
    title: "Java 25",
    versionName: "Adoptium OpenJDK 25",
    description: "Dernière version OpenJDK pour performances expérimentales",
    tag: "Moderne & Expérimental",
  },
];

function ToggleSwitch({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <div className="flex flex-col">
        <label
          htmlFor={id}
          className="text-sm font-medium text-ink cursor-pointer select-none"
        >
          {label}
        </label>
        {description && (
          <span className="text-xs text-neutral-400 mt-0.5 select-none leading-relaxed">
            {description}
          </span>
        )}
      </div>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border border-divider transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${
          checked ? "bg-accent" : "bg-well"
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full shadow-sm transition duration-200 ease-in-out ${
            checked ? "translate-x-5 bg-ink" : "translate-x-0 bg-neutral-400"
          }`}
        />
      </button>
    </div>
  );
}

export function ParametresTab({
  importJson,
  setImportJson,
  handleImportProfile,
  error,
  onSaved,
}: ParametresTabProps) {
  const { t, i18n } = useTranslation();

  // Navigation interne par catégories (type Modrinth / Prism Launcher)
  const [activeSection, setActiveSection] = useState<SettingsSection>("java");

  // Réglages du formulaire
  const [ramMin, setRamMin] = useState(2);
  const [ramMax, setRamMax] = useState(4);
  const [javaPath, setJavaPath] = useState("");
  const [javasTrouves, setJavasTrouves] = useState<JavaTrouve[] | null>(null);
  const [detection, setDetection] = useState(false);
  const [jvmArgs, setJvmArgs] = useState("");
  const [showAdvancedJvm, setShowAdvancedJvm] = useState(false);
  const [resolution, setResolution] = useState({ width: 1280, height: 720 });
  const [fullscreen, setFullscreen] = useState(false);
  const [autoConnect, setAutoConnect] = useState(true);
  const [keepOpen, setKeepOpen] = useState(false);
  const [selectedLang, setSelectedLang] = useState<"fr" | "en">("fr");

  // Téléchargement des Java
  const [installingJava, setInstallingJava] = useState<Record<number, boolean>>({});
  const [installingAll, setInstallingAll] = useState(false);
  const [javaNotice, setJavaNotice] = useState<string | null>(null);

  // État de sauvegarde
  const [initialSettings, setInitialSettings] = useState<LauncherSettings | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchSettings()
      .then((s) => {
        if (cancelled) return;
        setInitialSettings(s);
        setRamMin(Math.round(s.ramMinMb / 1024));
        setRamMax(Math.round(s.ramMaxMb / 1024));
        setJavaPath(s.javaPath);
        setJvmArgs(s.jvmArgs);
        if (s.jvmArgs.trim().length > 0) {
          setShowAdvancedJvm(true);
        }
        setResolution({ width: s.width, height: s.height });
        setFullscreen(s.fullscreen);
        setKeepOpen(s.keepLauncherOpen);
        setAutoConnect(s.autoConnect);
        const resolvedLang = s.language === "en" ? "en" : "fr";
        setSelectedLang(resolvedLang);
      })
      .catch(() => {
        // En cas d'erreur de chargement initial, les valeurs par défaut restent en place
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    // Détecte automatiquement les Java disponibles au chargement
    demandeLesJava()
      .then((javas) => {
        if (!cancelled) setJavasTrouves(javas);
      })
      .catch(() => {
        if (!cancelled) setJavasTrouves([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function handleRamMinChange(val: number) {
    const clamped = Math.max(1, Math.min(16, val));
    setRamMin(clamped);
    if (clamped > ramMax) {
      setRamMax(clamped);
    }
  }

  function handleRamMaxChange(val: number) {
    const clamped = Math.max(1, Math.min(16, val));
    setRamMax(clamped);
    if (clamped < ramMin) {
      setRamMin(clamped);
    }
  }

  function applyRamPreset(preset: RAMPreset) {
    setRamMin(preset.min);
    setRamMax(preset.max);
  }

  async function rafraichirJava() {
    setDetection(true);
    try {
      const javas = await demandeLesJava();
      setJavasTrouves(javas);
    } catch {
      setJavasTrouves([]);
    } finally {
      setDetection(false);
    }
  }

  async function handleInstallJava(major: number) {
    setInstallingJava((prev) => ({ ...prev, [major]: true }));
    setJavaNotice(null);
    try {
      await installerJava(major);
      const updated = await demandeLesJava();
      setJavasTrouves(updated);
      setJavaNotice(`Java ${major} a été téléchargé et installé avec succès.`);
    } catch (e) {
      setJavaNotice(`Erreur lors de l'installation de Java ${major} : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setInstallingJava((prev) => ({ ...prev, [major]: false }));
    }
  }

  async function handleInstallAllJavas() {
    setInstallingAll(true);
    setJavaNotice(null);
    let successCount = 0;
    for (const target of MANAGED_JAVA_TARGETS) {
      const alreadyInstalled = javasTrouves?.some((j) => j.major === target.major);
      if (!alreadyInstalled) {
        setInstallingJava((prev) => ({ ...prev, [target.major]: true }));
        try {
          await installerJava(target.major);
          successCount++;
        } catch (e) {
          console.error(`Échec pour Java ${target.major}:`, e);
        } finally {
          setInstallingJava((prev) => ({ ...prev, [target.major]: false }));
        }
      }
    }
    const updated = await demandeLesJava();
    setJavasTrouves(updated);
    setInstallingAll(false);
    setJavaNotice(
      successCount > 0
        ? `${successCount} version(s) de Java installée(s) avec succès !`
        : "Toutes les versions recommandées de Java sont déjà installées.",
    );
  }

  function handleLanguageChange(newLang: "fr" | "en") {
    setSelectedLang(newLang);
    void i18n.changeLanguage(newLang);
  }

  const hasChanges =
    initialSettings !== null &&
    (ramMin !== Math.round(initialSettings.ramMinMb / 1024) ||
      ramMax !== Math.round(initialSettings.ramMaxMb / 1024) ||
      javaPath !== initialSettings.javaPath ||
      jvmArgs !== initialSettings.jvmArgs ||
      resolution.width !== initialSettings.width ||
      resolution.height !== initialSettings.height ||
      fullscreen !== initialSettings.fullscreen ||
      keepOpen !== initialSettings.keepLauncherOpen ||
      autoConnect !== initialSettings.autoConnect ||
      selectedLang !== (initialSettings.language === "en" ? "en" : "fr"));

  function handleReset() {
    if (!initialSettings) return;
    setRamMin(Math.round(initialSettings.ramMinMb / 1024));
    setRamMax(Math.round(initialSettings.ramMaxMb / 1024));
    setJavaPath(initialSettings.javaPath);
    setJvmArgs(initialSettings.jvmArgs);
    setResolution({ width: initialSettings.width, height: initialSettings.height });
    setFullscreen(initialSettings.fullscreen);
    setKeepOpen(initialSettings.keepLauncherOpen);
    setAutoConnect(initialSettings.autoConnect);
    const initialLang = initialSettings.language === "en" ? "en" : "fr";
    setSelectedLang(initialLang);
    void i18n.changeLanguage(initialLang);
  }

  async function handleSave() {
    setSaveState("saving");
    setSaveError(null);

    const payload: LauncherSettings = {
      ramMinMb: ramMin * 1024,
      ramMaxMb: ramMax * 1024,
      javaPath,
      jvmArgs,
      width: resolution.width,
      height: resolution.height,
      fullscreen,
      keepLauncherOpen: keepOpen,
      autoConnect,
      language: selectedLang,
    };

    try {
      const saved = await saveSettings(payload);
      setInitialSettings(saved);
      setRamMin(Math.round(saved.ramMinMb / 1024));
      setRamMax(Math.round(saved.ramMaxMb / 1024));
      onSaved?.();
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Sauvegarde impossible");
      setSaveState("error");
    }
  }

  return (
    <div className="flex flex-col md:flex-row gap-6 min-h-0 pb-20 items-start">
      {/* 1. Sous-navigation latérale (style Launcher moderne) */}
      <nav
        aria-label="Catégories des paramètres"
        className="w-full md:w-56 shrink-0 bg-surface/70 border border-divider rounded-xl p-3 space-y-4"
      >
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 px-2 block mb-1.5">
            Affichage & Système
          </span>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setActiveSection("window")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                activeSection === "window"
                  ? "bg-accent/15 text-accent-200 border-l-2 border-accent font-semibold"
                  : "text-neutral-300 hover:text-ink hover:bg-well/60"
              }`}
            >
              <Monitor className="w-4 h-4 shrink-0 text-accent" />
              <span>Fenêtre & Affichage</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("behavior")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                activeSection === "behavior"
                  ? "bg-accent/15 text-accent-200 border-l-2 border-accent font-semibold"
                  : "text-neutral-300 hover:text-ink hover:bg-well/60"
              }`}
            >
              <Sliders className="w-4 h-4 shrink-0 text-accent" />
              <span>Comportement</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("language")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                activeSection === "language"
                  ? "bg-accent/15 text-accent-200 border-l-2 border-accent font-semibold"
                  : "text-neutral-300 hover:text-ink hover:bg-well/60"
              }`}
            >
              <Globe className="w-4 h-4 shrink-0 text-accent" />
              <span>Langue d'affichage</span>
            </button>
          </div>
        </div>

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 px-2 block mb-1.5">
            Instances & Jeu
          </span>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setActiveSection("java")}
              className={`w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                activeSection === "java"
                  ? "bg-accent/15 text-accent-200 border-l-2 border-accent font-semibold"
                  : "text-neutral-300 hover:text-ink hover:bg-well/60"
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Coffee className="w-4 h-4 shrink-0 text-accent" />
                <span className="truncate">Installations Java</span>
              </div>
              <span className="text-[10px] bg-well text-neutral-400 px-1.5 py-0.5 rounded border border-divider">
                8-25
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("ram")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                activeSection === "ram"
                  ? "bg-accent/15 text-accent-200 border-l-2 border-accent font-semibold"
                  : "text-neutral-300 hover:text-ink hover:bg-well/60"
              }`}
            >
              <Cpu className="w-4 h-4 shrink-0 text-accent" />
              <span>Mémoire vive (RAM)</span>
            </button>
          </div>
        </div>

        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 px-2 block mb-1.5">
            Outils & Avancé
          </span>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => setActiveSection("import")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                activeSection === "import"
                  ? "bg-accent/15 text-accent-200 border-l-2 border-accent font-semibold"
                  : "text-neutral-300 hover:text-ink hover:bg-well/60"
              }`}
            >
              <FileJson className="w-4 h-4 shrink-0 text-accent" />
              <span>Import de profil</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveSection("all")}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                activeSection === "all"
                  ? "bg-accent/15 text-accent-200 border-l-2 border-accent font-semibold"
                  : "text-neutral-400 hover:text-ink hover:bg-well/60"
              }`}
            >
              <Layers className="w-4 h-4 shrink-0 text-accent" />
              <span>Tout afficher</span>
            </button>
          </div>
        </div>
      </nav>

      {/* 2. Zone de contenu principale des paramètres */}
      <div className="flex-1 min-w-0 space-y-6 w-full">
        {/* SECTION : INSTALLATIONS JAVA */}
        {(activeSection === "java" || activeSection === "all") && (
          <section className="bg-surface border border-divider rounded-xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-well flex items-center justify-center text-accent">
                  <Coffee className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-ink">Installations Java (Runtimes)</h2>
                  <p className="text-xs text-neutral-400">
                    Installez et gérez les versions de Java requises selon vos versions de Minecraft.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleInstallAllJavas}
                  disabled={installingAll}
                  className="px-3 py-1.5 rounded-lg bg-accent/20 hover:bg-accent/30 text-accent-200 border border-accent/40 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Télécharger automatiquement toutes les versions recommandées non encore installées"
                >
                  {installingAll ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  <span>{installingAll ? "Installation groupée..." : "Tout installer (8, 17, 21, 25)"}</span>
                </button>

                <button
                  type="button"
                  onClick={rafraichirJava}
                  disabled={detection}
                  className="px-2.5 py-1.5 rounded-lg bg-well hover:bg-neutral-800 border border-divider text-xs text-neutral-300 hover:text-ink flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                  title="Analyser le système pour détecter les nouvelles versions"
                >
                  <Search className={`w-3.5 h-3.5 ${detection ? "animate-spin text-accent" : ""}`} />
                  <span className="hidden sm:inline">Actualiser</span>
                </button>
              </div>
            </div>

            {javaNotice && (
              <div className="p-3 rounded-lg border border-divider bg-well/40 text-xs text-ink flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{javaNotice}</span>
              </div>
            )}

            {/* Grille des 4 versions principales de Java */}
            <div>
              <span className="text-xs font-semibold text-neutral-300 block mb-2.5">
                Versions officielles recommandées pour Minecraft :
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MANAGED_JAVA_TARGETS.map((target) => {
                  const matchingInstalled = javasTrouves?.filter((j) => j.major === target.major) ?? [];
                  const isInstalled = matchingInstalled.length > 0;
                  const isCurrentlyActive = matchingInstalled.some((j) => j.chemin === javaPath);
                  const isBusy = installingJava[target.major];

                  return (
                    <div
                      key={target.major}
                      className={`p-3.5 rounded-lg border transition-all flex flex-col justify-between gap-3 ${
                        isCurrentlyActive
                          ? "border-accent bg-accent/10"
                          : isInstalled
                            ? "border-divider bg-well/30"
                            : "border-divider bg-well/15"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-ink">{target.title}</span>
                            <span className="text-[10px] text-neutral-400 font-mono">
                              ({target.versionName})
                            </span>
                          </div>
                          {isInstalled ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <Check className="w-3 h-3" />
                              Installé
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-400 bg-well px-2 py-0.5 rounded-full border border-divider">
                              Non installé
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-400 leading-relaxed">
                          {target.description}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-divider/60">
                        <span className="text-[11px] text-accent-300 font-medium">
                          {target.tag}
                        </span>

                        {isInstalled ? (
                          <button
                            type="button"
                            onClick={() => {
                              const bestPath = matchingInstalled[0]?.chemin ?? "";
                              setJavaPath(bestPath);
                            }}
                            className={`text-xs px-2.5 py-1 rounded-md transition-colors cursor-pointer font-medium ${
                              isCurrentlyActive
                                ? "bg-accent text-ink"
                                : "bg-well hover:bg-neutral-800 text-neutral-300 hover:text-ink border border-divider"
                            }`}
                          >
                            {isCurrentlyActive ? "Actif pour le lancement" : "Utiliser cette version"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleInstallJava(target.major)}
                            disabled={isBusy || installingAll}
                            className="text-xs px-3 py-1.5 rounded-md bg-accent hover:bg-accent-600 disabled:opacity-50 text-ink font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                          >
                            {isBusy ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Download className="w-3 h-3" />
                            )}
                            <span>{isBusy ? "Installation..." : "Télécharger & Installer"}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Mode de sélection actuel */}
            <div className="pt-3 border-t border-divider">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-300">
                  Mode de sélection :
                </span>
                {javaPath && (
                  <button
                    type="button"
                    onClick={() => setJavaPath("")}
                    className="text-xs text-accent-300 hover:text-ink flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Rétablir la détection automatique
                  </button>
                )}
              </div>

              <div className="p-3 rounded-lg border border-divider bg-well/40 flex items-center justify-between gap-3">
                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink">
                      {javaPath ? "Binaire personnalisé sélectionné" : "Sélection automatique (Recommandé)"}
                    </span>
                    <span className="text-[10px] bg-accent/20 text-accent-200 px-2 py-0.5 rounded-full border border-accent/30 font-medium">
                      {javaPath ? "Manuel" : "Automatique"}
                    </span>
                  </div>
                  <span className="block text-[11px] text-neutral-400 font-mono truncate mt-0.5">
                    {javaPath
                      ? javaPath
                      : "Le launcher choisit automatiquement la version exacte adaptée au profil lancé."}
                  </span>
                </div>
              </div>
            </div>

            {/* Saisie manuelle & Options avancées */}
            <div className="pt-2 border-t border-divider">
              <button
                type="button"
                onClick={() => setShowAdvancedJvm(!showAdvancedJvm)}
                className="text-xs font-medium text-neutral-300 hover:text-ink flex items-center justify-between w-full py-1 cursor-pointer transition-colors rounded"
              >
                <span className="flex items-center gap-2">
                  <Terminal className="w-3.5 h-3.5 text-accent" />
                  Chemin manuel & Arguments JVM avancés
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-200 ${
                    showAdvancedJvm ? "rotate-180 text-ink" : "text-neutral-400"
                  }`}
                />
              </button>

              {showAdvancedJvm && (
                <div className="mt-3 space-y-3 pt-2">
                  <div>
                    <label htmlFor="custom-java-path" className="text-xs text-neutral-400 block mb-1">
                      Chemin absolu vers un exécutable Java externe :
                    </label>
                    <input
                      id="custom-java-path"
                      type="text"
                      value={javaPath}
                      onChange={(e) => setJavaPath(e.target.value)}
                      placeholder="Ex : /usr/lib/jvm/java-21 ou C:\Program Files\Java\jdk-21\bin\javaw.exe"
                      className="w-full bg-well border border-divider rounded-lg px-3 py-2 text-xs text-ink font-mono placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="custom-jvm-args" className="text-xs text-neutral-400 block mb-1">
                      Arguments JVM supplémentaires :
                    </label>
                    <input
                      id="custom-jvm-args"
                      type="text"
                      value={jvmArgs}
                      onChange={(e) => setJvmArgs(e.target.value)}
                      placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled"
                      className="w-full bg-well border border-divider rounded-lg px-3 py-2 text-xs text-ink font-mono placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                    />
                    <p className="text-[11px] text-neutral-400 mt-1">
                      Les arguments de base sont déjà gérés par le launcher. Ce champ s'ajoute en complément.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* SECTION : MÉMOIRE VIVE (RAM) */}
        {(activeSection === "ram" || activeSection === "all") && (
          <section className="bg-surface border border-divider rounded-xl p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-well flex items-center justify-center text-accent">
                <Cpu className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink">Mémoire vive (RAM)</h2>
                <p className="text-xs text-neutral-400">
                  Allocation mémoire minimale et maximale allouée à Minecraft.
                </p>
              </div>
            </div>

            {/* Préréglages */}
            <div className="pt-3 border-t border-divider">
              <span className="text-xs font-semibold text-neutral-300 block mb-2">
                Configurations rapides :
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {RAM_PRESETS.map((preset) => {
                  const active = ramMin === preset.min && ramMax === preset.max;
                  return (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyRamPreset(preset)}
                      className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        active
                          ? "border-accent bg-accent/15 text-ink"
                          : "border-divider bg-well/40 hover:border-neutral-500 text-neutral-300 hover:text-ink"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold">{preset.label}</span>
                        <span className="text-[11px] font-mono text-neutral-400">
                          {preset.min}-{preset.max} Go
                        </span>
                      </div>
                      <span className="block text-[11px] text-neutral-400 mt-1 line-clamp-1">
                        {preset.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Curseurs interactifs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="bg-well/40 border border-divider rounded-lg p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="ram-min" className="text-xs font-medium text-neutral-300">
                    RAM minimale (Xms)
                  </label>
                  <span className="text-ink font-mono font-bold text-sm bg-well px-2 py-0.5 rounded border border-divider">
                    {ramMin} Go
                  </span>
                </div>
                <input
                  id="ram-min"
                  type="range"
                  min={1}
                  max={16}
                  value={ramMin}
                  aria-label="RAM minimale en Go"
                  aria-valuemin={1}
                  aria-valuemax={16}
                  aria-valuenow={ramMin}
                  onChange={(e) => handleRamMinChange(Number(e.target.value))}
                  className="w-full accent-accent cursor-pointer h-2 bg-well rounded-lg appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <div className="flex justify-between text-[11px] text-neutral-400 font-mono mt-1">
                  <span>1 Go</span>
                  <span>8 Go</span>
                  <span>16 Go</span>
                </div>
              </div>

              <div className="bg-well/40 border border-divider rounded-lg p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="ram-max" className="text-xs font-medium text-neutral-300">
                    RAM maximale (Xmx)
                  </label>
                  <span className="text-ink font-mono font-bold text-sm bg-well px-2 py-0.5 rounded border border-divider">
                    {ramMax} Go
                  </span>
                </div>
                <input
                  id="ram-max"
                  type="range"
                  min={1}
                  max={16}
                  value={ramMax}
                  aria-label="RAM maximale en Go"
                  aria-valuemin={1}
                  aria-valuemax={16}
                  aria-valuenow={ramMax}
                  onChange={(e) => handleRamMaxChange(Number(e.target.value))}
                  className="w-full accent-accent cursor-pointer h-2 bg-well rounded-lg appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                />
                <div className="flex justify-between text-[11px] text-neutral-400 font-mono mt-1">
                  <span>1 Go</span>
                  <span>8 Go</span>
                  <span>16 Go</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed">
              Conseil : 2 Go min et 4 Go max conviennent parfaitement pour le jeu standard. Pour les gros modpacks (All The Mods, packs de shaders), attribuez entre 6 et 8 Go.
            </p>
          </section>
        )}

        {/* SECTION : FENÊTRE & AFFICHAGE */}
        {(activeSection === "window" || activeSection === "all") && (
          <section className="bg-surface border border-divider rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-well flex items-center justify-center text-accent">
                <Monitor className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink">Fenêtre de jeu</h2>
                <p className="text-xs text-neutral-400">
                  Résolution et mode d'affichage au lancement de Minecraft.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-divider">
              <ToggleSwitch
                id="fullscreen-mode-toggle"
                checked={fullscreen}
                onChange={setFullscreen}
                label="Lancer en plein écran"
                description="Démarre Minecraft directement en plein écran (touche F11 en jeu pour basculer)."
              />
            </div>

            {!fullscreen && (
              <div className="pt-3 border-t border-divider space-y-3">
                <span className="text-xs font-semibold text-neutral-300 block mb-1">
                  Résolutions standard :
                </span>
                <div className="grid grid-cols-3 gap-2">
                  {RESOLUTION_PRESETS.map((res) => {
                    const active = resolution.width === res.width && resolution.height === res.height;
                    return (
                      <button
                        key={res.label}
                        type="button"
                        onClick={() => setResolution({ width: res.width, height: res.height })}
                        className={`p-2 rounded-lg border text-center transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                          active
                            ? "border-accent bg-accent/15 text-ink"
                            : "border-divider bg-well/40 hover:border-neutral-500 text-neutral-300 hover:text-ink"
                        }`}
                      >
                        <span className="block text-xs font-semibold">{res.label}</span>
                        <span className="block text-[11px] font-mono text-neutral-400">
                          {res.width} × {res.height}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label htmlFor="res-w" className="text-xs font-medium text-neutral-300 block mb-1.5">
                      Largeur (pixels)
                    </label>
                    <input
                      id="res-w"
                      type="number"
                      min={640}
                      max={3840}
                      value={resolution.width}
                      onChange={(e) =>
                        setResolution((r) => ({ ...r, width: Number(e.target.value) }))
                      }
                      className="w-full bg-well border border-divider rounded-lg px-3 py-2 text-xs text-ink font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                    />
                  </div>

                  <div>
                    <label htmlFor="res-h" className="text-xs font-medium text-neutral-300 block mb-1.5">
                      Hauteur (pixels)
                    </label>
                    <input
                      id="res-h"
                      type="number"
                      min={480}
                      max={2160}
                      value={resolution.height}
                      onChange={(e) =>
                        setResolution((r) => ({ ...r, height: Number(e.target.value) }))
                      }
                      className="w-full bg-well border border-divider rounded-lg px-3 py-2 text-xs text-ink font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors"
                    />
                  </div>
                </div>

                <p className="text-xs text-neutral-400">
                  Définissez des dimensions inférieures à celles de votre moniteur pour conserver la visibilité de vos barres de tâches.
                </p>
              </div>
            )}
          </section>
        )}

        {/* SECTION : COMPORTEMENT */}
        {(activeSection === "behavior" || activeSection === "all") && (
          <section className="bg-surface border border-divider rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-well flex items-center justify-center text-accent">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink">Comportement du launcher</h2>
                <p className="text-xs text-neutral-400">
                  Préférences d'exécution et de session de Paranoia Launcher.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-divider divide-y divide-divider">
              <ToggleSwitch
                id="keep-open-setting"
                checked={keepOpen}
                onChange={setKeepOpen}
                label="Garder le launcher ouvert pendant le jeu"
                description="L'application reste active en tâche de fond pour consulter les journaux ou relancer rapidement."
              />

              <ToggleSwitch
                id="auto-connect-setting"
                checked={autoConnect}
                onChange={setAutoConnect}
                label="Connexion automatique au démarrage"
                description="Restaure automatiquement votre session de jeu à l'ouverture de l'application."
              />
            </div>
          </section>
        )}

        {/* SECTION : LANGUE (SANS AUCUN BUG BLANC) */}
        {(activeSection === "language" || activeSection === "all") && (
          <section className="bg-surface border border-divider rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-well flex items-center justify-center text-accent">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink">{t("settings.language")}</h2>
                <p className="text-xs text-neutral-400">
                  Langue utilisée pour les menus, infobulles et libellés de l'application.
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-divider flex items-center justify-between gap-4">
              <span className="text-xs text-neutral-300 font-medium">
                Sélectionnez votre langue :
              </span>

              {/* Boutons sombres segmentés : aucun élément select natif avec fond blanc */}
              <div
                className="flex items-center rounded-lg border border-divider bg-well p-1"
                role="group"
                aria-label={t("settings.language")}
              >
                <button
                  type="button"
                  onClick={() => handleLanguageChange("fr")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    selectedLang === "fr"
                      ? "bg-accent/20 text-accent-100 border border-accent/40 shadow-xs"
                      : "text-neutral-400 hover:text-ink border border-transparent"
                  }`}
                >
                  Français
                </button>
                <button
                  type="button"
                  onClick={() => handleLanguageChange("en")}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    selectedLang === "en"
                      ? "bg-accent/20 text-accent-100 border border-accent/40 shadow-xs"
                      : "text-neutral-400 hover:text-ink border border-transparent"
                  }`}
                >
                  English
                </button>
              </div>
            </div>
          </section>
        )}

        {/* SECTION : IMPORTATION DE PROFIL */}
        {(activeSection === "import" || activeSection === "all") && (
          <section className="bg-surface border border-divider rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-well flex items-center justify-center text-accent">
                <FileJson className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-ink">{t("settings.import_title")}</h2>
                <p className="text-xs text-neutral-400">{t("settings.import_desc")}</p>
              </div>
            </div>

            <div className="pt-3 border-t border-divider space-y-3">
              <label htmlFor="json-import-box" className="text-xs text-neutral-300 block">
                Configuration de profil exportée (JSON) :
              </label>
              <textarea
                id="json-import-box"
                rows={4}
                className="w-full bg-well border border-divider rounded-lg p-3 text-xs text-ink font-mono placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent transition-colors resize-none"
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder='{ "name": "Mon profil", "minecraftVersion": "1.21.1", "ramMb": 4096 }'
              />
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleImportProfile}
                  disabled={!importJson.trim()}
                  className="px-4 py-2 bg-well hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed text-ink text-xs font-semibold rounded-lg border border-divider transition-colors flex items-center gap-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  <Upload className="w-3.5 h-3.5 text-accent" />
                  {t("settings.import_validate")}
                </button>

                {error && (
                  <span className="text-xs text-danger flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    {error}
                  </span>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      {/* 3. Barre de sauvegarde persistante en bas */}
      <div className="fixed bottom-4 left-6 right-6 md:left-64 z-20 bg-surface/95 backdrop-blur-md border border-divider rounded-xl p-3.5 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          {hasChanges ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 bg-amber-400/10 px-2.5 py-1 rounded-full border border-amber-400/20">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Modifications non enregistrées
            </span>
          ) : (
            <span className="text-xs text-neutral-400">
              Tous les paramètres sont à jour.
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {hasChanges && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3.5 py-2 text-xs font-medium text-neutral-300 hover:text-ink hover:bg-well rounded-lg border border-divider transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Annuler
            </button>
          )}

          <button
            type="button"
            onClick={handleSave}
            disabled={!loaded || saveState === "saving"}
            className="px-5 py-2.5 bg-accent hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed text-ink text-xs font-semibold rounded-lg transition-colors flex items-center gap-2 cursor-pointer shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {saveState === "saving" && <Loader2 className="w-4 h-4 animate-spin" />}
            {saveState === "saved" && <Check className="w-4 h-4 text-emerald-300" />}
            {saveState === "error" && <AlertTriangle className="w-4 h-4 text-danger" />}
            {saveState === "saving"
              ? "Enregistrement..."
              : saveState === "saved"
                ? "Paramètres enregistrés !"
                : saveState === "error"
                  ? "Erreur, réessayer"
                  : "Enregistrer les modifications"}
          </button>
        </div>
      </div>

      {saveState === "error" && saveError && (
        <div className="fixed bottom-20 right-6 z-20 p-3 rounded-lg border border-danger/30 bg-danger/10 text-xs text-danger flex items-center gap-2 shadow-lg">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}
    </div>
  );
}

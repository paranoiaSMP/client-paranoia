import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, AlertTriangle } from "lucide-react";
import {
  fetchSettings,
  saveSettings,
  type LauncherSettings,
} from "../../../shared/api/settingsClient";

type ParametresTabProps = {
  importJson: string;
  setImportJson: (json: string) => void;
  handleImportProfile: () => void;
  error: string | null;
};

export function ParametresTab({ importJson, setImportJson, handleImportProfile, error }: ParametresTabProps) {
  const { t, i18n } = useTranslation();

  const [ramMin, setRamMin] = useState(2);
  const [ramMax, setRamMax] = useState(4);
  const [javaPath, setJavaPath] = useState("");
  const [jvmArgs, setJvmArgs] = useState("-XX:+UseG1GC");
  const [resolution, setResolution] = useState({ width: 1280, height: 720 });
  const [fullscreen, setFullscreen] = useState(false);
  const [autoConnect, setAutoConnect] = useState(true);
  const [keepOpen, setKeepOpen] = useState(false);

  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  /* Les reglages vivaient uniquement en memoire: changer d'onglet les perdait
   * et aucun n'atteignait le lancement. On les charge depuis le backend. */
  useEffect(() => {
    let cancelled = false;

    fetchSettings()
      .then((s) => {
        if (cancelled) return;
        setRamMin(Math.round(s.ramMinMb / 1024));
        setRamMax(Math.round(s.ramMaxMb / 1024));
        setJavaPath(s.javaPath);
        setJvmArgs(s.jvmArgs);
        setResolution({ width: s.width, height: s.height });
        setFullscreen(s.fullscreen);
        setKeepOpen(s.keepLauncherOpen);
        setAutoConnect(s.autoConnect);
      })
      .catch(() => {
        // Valeurs par defaut deja en place: on n'empeche pas d'utiliser l'onglet.
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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
      language: (i18n.language === "en" ? "en" : "fr") as "fr" | "en",
    };

    try {
      const saved = await saveSettings(payload);
      // Le backend peut corriger la saisie (RAM max sous la min): on reprend
      // ce qu'il a reellement enregistre.
      setRamMin(Math.round(saved.ramMinMb / 1024));
      setRamMax(Math.round(saved.ramMaxMb / 1024));
      setSaveState("saved");
      setTimeout(() => setSaveState("idle"), 2500);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Sauvegarde impossible");
      setSaveState("error");
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-400 pt-2 pb-10">

      {/* RAM */}
      <section className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
        <h3 className="text-white font-bold mb-4">Mémoire (RAM)</h3>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[#a1a1aa] text-xs block mb-2">RAM minimum</label>
            <div className="flex items-center gap-3">
              <input 
                type="range" min={1} max={16} value={ramMin}
                onChange={e => setRamMin(Number(e.target.value))}
                className="flex-1 accent-accent-purple"
              />
              <span className="text-white font-mono text-sm w-14 text-right">{ramMin} Go</span>
            </div>
          </div>
          <div>
            <label className="text-[#a1a1aa] text-xs block mb-2">RAM maximum</label>
            <div className="flex items-center gap-3">
              <input 
                type="range" min={1} max={16} value={ramMax}
                onChange={e => setRamMax(Number(e.target.value))}
                className="flex-1 accent-accent-purple"
              />
              <span className="text-white font-mono text-sm w-14 text-right">{ramMax} Go</span>
            </div>
          </div>
        </div>
        <p className="text-[#52525b] text-xs mt-3">Recommandé : 2 Go min, 4 Go max pour la plupart des configs.</p>
      </section>

      {/* Java */}
      <section className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
        <h3 className="text-white font-bold mb-4">Java</h3>
        
        <div className="mb-4">
          <label className="text-[#a1a1aa] text-xs block mb-2">Chemin Java (laisser vide = auto)</label>
          <input 
            type="text" 
            value={javaPath}
            onChange={e => setJavaPath(e.target.value)}
            placeholder="C:\Program Files\Java\jdk-21\bin\javaw.exe"
            className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder:text-[#3f3f46] focus:outline-none focus:border-accent-purple transition-colors"
          />
        </div>

        <div>
          <label className="text-[#a1a1aa] text-xs block mb-2">Arguments JVM</label>
          <input 
            type="text" 
            value={jvmArgs}
            onChange={e => setJvmArgs(e.target.value)}
            className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder:text-[#3f3f46] focus:outline-none focus:border-accent-purple transition-colors"
          />
          <p className="text-[#52525b] text-xs mt-2">Touche pas à ça si tu sais pas ce que c'est.</p>
        </div>
      </section>

      {/* Fenêtre */}
      <section className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
        <h3 className="text-white font-bold mb-4">Fenêtre de jeu</h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="text-[#a1a1aa] text-xs block mb-2">Largeur</label>
            <input 
              type="number" 
              value={resolution.width}
              onChange={e => setResolution(r => ({ ...r, width: Number(e.target.value) }))}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent-purple transition-colors"
            />
          </div>
          <div>
            <label className="text-[#a1a1aa] text-xs block mb-2">Hauteur</label>
            <input 
              type="number" 
              value={resolution.height}
              onChange={e => setResolution(r => ({ ...r, height: Number(e.target.value) }))}
              className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2.5 text-sm text-white font-mono focus:outline-none focus:border-accent-purple transition-colors"
            />
          </div>
        </div>

        <label className="flex items-center gap-3 cursor-pointer group">
          <input type="checkbox" checked={fullscreen} onChange={e => setFullscreen(e.target.checked)} className="accent-accent-purple w-4 h-4" />
          <span className="text-sm text-[#a1a1aa] group-hover:text-white transition-colors">Lancer en plein écran</span>
        </label>
      </section>

      {/* Launcher */}
      <section className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
        <h3 className="text-white font-bold mb-4">Launcher</h3>
        
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" checked={keepOpen} onChange={e => setKeepOpen(e.target.checked)} className="accent-accent-purple w-4 h-4" />
            <span className="text-sm text-[#a1a1aa] group-hover:text-white transition-colors">Garder le launcher ouvert pendant le jeu</span>
          </label>
          <label className="flex items-center gap-3 cursor-pointer group">
            <input type="checkbox" checked={autoConnect} onChange={e => setAutoConnect(e.target.checked)} className="accent-accent-purple w-4 h-4" />
            <span className="text-sm text-[#a1a1aa] group-hover:text-white transition-colors">Se connecter automatiquement au démarrage</span>
          </label>
        </div>
      </section>

      {/* Langue */}
      <section className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
        <h3 className="text-white font-bold mb-4">{t("settings.language")}</h3>
        <select 
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="w-full bg-[#09090b] border border-[#27272a] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-accent-purple transition-colors cursor-pointer"
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </section>

      {/* Sauvegarde */}
      <section className="bg-[#18181b] border border-[#27272a] rounded-xl p-5 flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={!loaded || saveState === "saving"}
          className="px-5 py-2.5 bg-accent-purple hover:bg-accent-purple-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2"
        >
          {saveState === "saving" && <Loader2 className="w-4 h-4 animate-spin" />}
          {saveState === "saved" && <Check className="w-4 h-4" />}
          {saveState === "saving"
            ? "Enregistrement..."
            : saveState === "saved"
              ? "Enregistré"
              : "Enregistrer les paramètres"}
        </button>

        {saveState === "error" && saveError && (
          <span className="text-sm text-[#fca5a5] flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {saveError}
          </span>
        )}

        {saveState !== "error" && (
          <span className="text-[#52525b] text-xs">
            Appliqué au prochain lancement du jeu.
          </span>
        )}
      </section>

      {/* Import JSON (gardé de l'ancien) */}
      <section className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
        <h3 className="text-white font-bold mb-1">{t("settings.import_title")}</h3>
        <p className="text-[#52525b] text-xs mb-4">{t("settings.import_desc")}</p>
        <textarea 
          className="w-full h-28 bg-[#09090b] border border-[#27272a] rounded-lg p-3 text-sm text-white font-mono placeholder:text-[#3f3f46] focus:outline-none focus:border-accent-purple transition-colors mb-3 resize-none"
          value={importJson} 
          onChange={(e) => setImportJson(e.target.value)} 
          placeholder='{ "name": "Mon profil", "minecraftVersion": "1.21.11" }' 
        />
        <button 
          onClick={handleImportProfile}
          className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {t("settings.import_validate")}
        </button>
        {error && <div className="mt-3 text-red-400 text-sm">{error}</div>}
      </section>

    </div>
  );
}

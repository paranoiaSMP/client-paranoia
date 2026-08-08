import { useState } from "react";
import { useTranslation } from "react-i18next";

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
  const [jvmArgs, setJvmArgs] = useState("-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions");
  const [resolution, setResolution] = useState({ width: 1280, height: 720 });
  const [fullscreen, setFullscreen] = useState(false);
  const [autoConnect, setAutoConnect] = useState(true);
  const [keepOpen, setKeepOpen] = useState(false);

  return (
    <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in duration-400 pt-2 pb-10">

      {/* RAM */}
      <section className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
        <h3 className="text-white font-bold mb-4">Mémoire (RAM)</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

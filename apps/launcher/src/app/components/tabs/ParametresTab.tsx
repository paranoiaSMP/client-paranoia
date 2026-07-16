import { useTranslation } from "react-i18next";

type ParametresTabProps = {
  importJson: string;
  setImportJson: (json: string) => void;
  handleImportProfile: () => void;
  error: string | null;
};

export function ParametresTab({ importJson, setImportJson, handleImportProfile, error }: ParametresTabProps) {
  const { t, i18n } = useTranslation();

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-4">
      <div>
        <h2 className="text-3xl font-black text-white mb-2">{t("settings.title")}</h2>
        <p className="text-[#8888a0] font-medium">{t("settings.subtitle")}</p>
      </div>

      <div className="bg-[#1c1c1e] border-2 border-[#2a2a2c] p-8 rounded-xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
        <h3 className="text-xl font-black text-white mb-4">{t("settings.language")}</h3>
        <select 
          value={i18n.language}
          onChange={(e) => i18n.changeLanguage(e.target.value)}
          className="w-full bg-[#0d0d0f] border-2 border-[#2a2a2c] rounded px-4 py-3 text-white font-bold focus:outline-none focus:border-accent-purple transition-colors appearance-none cursor-pointer"
        >
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </div>

      <div className="bg-[#1c1c1e] border-2 border-[#2a2a2c] p-8 rounded-xl shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
        <h3 className="text-xl font-black text-white mb-4">{t("settings.import_title")}</h3>
        <p className="text-[#8888a0] font-medium text-sm mb-6">{t("settings.import_desc")}</p>
        <textarea 
          className="w-full h-32 bg-[#0d0d0f] border-2 border-[#2a2a2c] rounded-md p-4 text-sm text-white/80 font-mono focus:outline-none focus:border-accent-purple transition-colors mb-4"
          value={importJson} 
          onChange={(e) => setImportJson(e.target.value)} 
          placeholder='{
  "name": "PvP Custom",
  "minecraftVersion": "1.21.11"
}' 
        />
        <button 
          onClick={handleImportProfile}
          className="px-6 py-3 bg-[#2a2a2c] hover:bg-[#3a3a3c] text-white font-bold rounded transition-all border border-[#4a4a4c]"
        >
          {t("settings.import_validate")}
        </button>
        {error && <div className="mt-4 text-accent-red font-bold text-sm">{error}</div>}
      </div>
    </div>
  );
}

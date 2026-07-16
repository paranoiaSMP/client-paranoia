import { Pickaxe, Plus, Star, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LauncherProfile } from "@paranoia/contracts";

type ProfilsTabProps = {
  profiles: LauncherProfile[];
  selectedProfileId: string;
  setSelectedProfileId: (id: string) => void;
  isCreatingProfile: boolean;
  setIsCreatingProfile: (creating: boolean) => void;
  onFavorite: (id: string) => void;
  onDelete: (id: string) => void;
};

export function ProfilsTab({
  profiles,
  selectedProfileId,
  setSelectedProfileId,
  isCreatingProfile,
  setIsCreatingProfile,
  onFavorite,
  onDelete
}: ProfilsTabProps) {
  const { t } = useTranslation();

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pt-4">
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-3xl font-black text-white mb-2">{t("profiles.title")}</h2>
          <p className="text-[#8888a0]">{t("profiles.subtitle")}</p>
        </div>
        <button 
          onClick={() => setIsCreatingProfile(!isCreatingProfile)}
          className="px-4 py-2 bg-accent-purple hover:bg-accent-purple-dark text-white font-bold rounded shadow-lg transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" strokeWidth={3} />
          {isCreatingProfile ? t("profiles.cancel") : t("profiles.new")}
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="text-center py-20 bg-[#1c1c1e] border-2 border-[#2a2a2c] rounded-xl border-dashed">
          <Pickaxe className="w-16 h-16 text-[#4a4a4c] mx-auto mb-4" strokeWidth={2} />
          <h3 className="text-xl font-bold text-white mb-2">{t("profiles.empty_title")}</h3>
          <p className="text-[#8888a0] mb-6">{t("profiles.empty_subtitle")}</p>
          <button 
            onClick={() => setIsCreatingProfile(true)}
            className="px-6 py-3 bg-white text-black font-black rounded hover:bg-gray-200 transition-all shadow-[4px_4px_0px_rgba(157,13,242,0.5)] active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            {t("profiles.create_btn")}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {profiles.map((profile) => (
            <div 
              key={profile.id}
              onClick={() => setSelectedProfileId(profile.id)}
              className={`relative group bg-[#1c1c1e] border-2 p-5 rounded-xl cursor-pointer transition-all duration-200 shadow-[inset_0_2px_8px_rgba(0,0,0,0.5)] ${selectedProfileId === profile.id ? 'border-accent-purple ring-2 ring-accent-purple/30' : 'border-[#2a2a2c] hover:border-[#4a4a4c]'}`}
            >
              {profile.favorite && (
                <div className="absolute top-4 right-4 text-yellow-400">
                  <Star className="w-5 h-5 fill-current drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" strokeWidth={2} />
                </div>
              )}
              <h3 className="text-xl font-black text-white mb-2 pr-6">{profile.name}</h3>
              <div className="flex gap-2 text-xs font-bold mb-6">
                <span className="px-2 py-1 bg-black/50 border border-[#2a2a2c] rounded text-white/80">{profile.minecraftVersion}</span>
                <span className="px-2 py-1 bg-black/50 border border-[#2a2a2c] rounded text-accent-purple">{profile.profileTypeId}</span>
              </div>
              
              <div className="flex gap-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); onFavorite(profile.id); }}
                  className="flex-1 py-2 bg-[#2a2a2c] hover:bg-[#3a3a3c] rounded text-xs font-bold text-white transition-colors border border-[#3a3a3c]"
                >
                  {t("profiles.favorite")}
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onDelete(profile.id); }}
                  className="w-10 flex justify-center items-center bg-red-500/20 hover:bg-red-500 text-red-300 hover:text-white rounded transition-colors border border-red-500/30 hover:border-red-600"
                >
                  <Trash2 className="w-4 h-4" strokeWidth={3} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

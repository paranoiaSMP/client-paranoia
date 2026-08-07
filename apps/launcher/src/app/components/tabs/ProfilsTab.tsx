import { Plus, Star, Search, Trash2, Play } from "lucide-react";
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
  onPlay: (id: string) => void;
};

export function ProfilsTab({
  profiles,
  selectedProfileId,
  setSelectedProfileId,
  isCreatingProfile,
  setIsCreatingProfile,
  onFavorite,
  onDelete,
  onPlay
}: ProfilsTabProps) {
  const { t } = useTranslation();
  
  const selectedProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];

  return (
    <div className="w-full animate-in fade-in duration-400 flex flex-col lg:flex-row gap-6 text-white pt-2">
      
      {/* GAUCHE */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Barre du haut */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center bg-[#18181b] rounded-lg px-3 py-2.5 flex-1 border border-[#27272a]">
             <Search className="w-4 h-4 text-[#52525b] mr-2 shrink-0" />
             <input 
               type="text" 
               placeholder={t("profiles.search") || "Chercher un profil..."}
               className="bg-transparent border-none outline-none text-sm w-full text-white placeholder:text-[#52525b]"
             />
          </div>
          <button 
            onClick={() => setIsCreatingProfile(!isCreatingProfile)}
            className="px-4 py-2.5 bg-accent-purple hover:bg-accent-purple-dark text-white text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 shrink-0"
          >
            <Plus className="w-4 h-4" />
            {isCreatingProfile ? t("profiles.cancel") : t("profiles.new")}
          </button>
        </div>

        {/* Grille de profils */}
        {profiles.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-20">
            <p className="text-[#71717a] text-lg mb-1">{t("profiles.empty_title")}</p>
            <p className="text-[#3f3f46] text-sm mb-6">{t("profiles.empty_subtitle")}</p>
            <button 
              onClick={() => setIsCreatingProfile(true)} 
              className="px-5 py-2.5 bg-accent-purple text-white font-semibold rounded-lg hover:bg-accent-purple-dark transition-colors"
            >
              {t("profiles.create_btn")}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto pb-6">
            {profiles.map((profile) => {
              const isSelected = selectedProfileId === profile.id;
              return (
                <div 
                  key={profile.id}
                  onClick={() => setSelectedProfileId(profile.id)}
                  className={`relative h-[150px] rounded-xl overflow-hidden cursor-pointer group transition-all duration-200 border-2 ${isSelected ? 'border-accent-purple' : 'border-transparent hover:border-[#3f3f46]'}`}
                >
                  {/* Fond avec l'image du serveur */}
                  <div className="absolute inset-0 bg-[#18181b]">
                    <div 
                      className="absolute inset-0 bg-cover bg-center opacity-30 group-hover:opacity-50 transition-opacity duration-300" 
                      style={{ backgroundImage: "url('/hero-bg.png')" }}
                    ></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#09090b] via-transparent to-transparent"></div>
                  </div>

                  {/* Nom du profil */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <p className="text-white font-bold text-lg leading-tight">{profile.name}</p>
                    <p className="text-[#a1a1aa] text-xs mt-1">{profile.minecraftVersion} &middot; {profile.profileTypeId}</p>
                  </div>

                  {/* Favori */}
                  {profile.favorite && (
                    <div className="absolute top-3 right-3">
                      <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DROITE - Détails */}
      {selectedProfile && (
        <div className="w-full lg:w-[340px] shrink-0">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
            
            {/* Image en haut */}
            <div className="h-36 relative">
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/hero-bg.png')" }}></div>
              <div className="absolute inset-0 bg-gradient-to-t from-[#18181b] to-transparent"></div>
            </div>

            {/* Contenu */}
            <div className="px-5 pb-5 -mt-4 relative">
              <h3 className="text-lg font-bold text-white">{selectedProfile.name}</h3>
              <p className="text-[#71717a] text-xs mt-1 mb-5">
                Version {selectedProfile.minecraftVersion} &middot; {selectedProfile.profileTypeId}
              </p>

              {/* Infos */}
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#a1a1aa]">Version</span>
                  <span className="text-white font-medium">{selectedProfile.minecraftVersion}</span>
                </div>
                <div className="h-px bg-[#27272a]"></div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#a1a1aa]">Type</span>
                  <span className="text-white font-medium capitalize">{selectedProfile.profileTypeId}</span>
                </div>
                <div className="h-px bg-[#27272a]"></div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[#a1a1aa]">Dossier</span>
                  <span className="text-[#71717a] text-xs font-mono">.minecraft</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button 
                  onClick={() => onFavorite(selectedProfile.id)}
                  className="w-10 h-10 bg-[#27272a] hover:bg-[#3f3f46] rounded-lg flex items-center justify-center transition-colors"
                  title="Favori"
                >
                  <Star className={`w-4 h-4 ${selectedProfile.favorite ? 'text-yellow-400 fill-yellow-400' : 'text-[#71717a]'}`} />
                </button>
                <button 
                  onClick={() => onDelete(selectedProfile.id)}
                  className="w-10 h-10 bg-[#27272a] hover:bg-red-900/40 text-[#71717a] hover:text-red-400 rounded-lg flex items-center justify-center transition-colors"
                  title="Supprimer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onPlay(selectedProfile.id)}
                  className="flex-1 h-10 bg-accent-purple hover:bg-accent-purple-dark text-white rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Jouer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { Pickaxe, Plus, Star, Search, Settings, Play } from "lucide-react";
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
  
  const selectedProfile = profiles.find(p => p.id === selectedProfileId) || profiles[0];

  return (
    <div className="w-full h-[calc(100vh-140px)] animate-in fade-in duration-500 flex flex-col lg:flex-row gap-8 text-white">
      
      {/* GAUCHE : Grille des profils */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Topbar Filtres & Ajout */}
        <div className="flex items-center justify-between mb-6 bg-[#151517] p-2 rounded-xl border border-[#2a2a2c]">
          <div className="flex items-center bg-[#0a0a0c] rounded-lg px-3 py-2 w-1/2 border border-[#2a2a2c]">
             <Search className="w-4 h-4 text-[#8888a0] mr-2" />
             <input 
               type="text" 
               placeholder="Search your Paranoia versions..." 
               className="bg-transparent border-none outline-none text-sm w-full text-white placeholder:text-[#4a4a4c]"
             />
          </div>
          <button 
            onClick={() => setIsCreatingProfile(!isCreatingProfile)}
            className="px-4 py-2 bg-[#0ea5e9] hover:bg-[#0284c7] text-white text-sm font-bold rounded-lg shadow-lg transition-all flex items-center gap-2"
          >
            <Plus className="w-4 h-4" strokeWidth={3} />
            {isCreatingProfile ? t("profiles.cancel") : "New Profile"}
          </button>
        </div>

        {/* Grille */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-[#2a2a2c] scrollbar-track-transparent pb-10">
          {profiles.map((profile) => {
            const isSelected = selectedProfileId === profile.id;
            return (
              <div 
                key={profile.id}
                onClick={() => setSelectedProfileId(profile.id)}
                className={`relative h-[180px] rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 ${isSelected ? 'ring-4 ring-[#10b981] scale-[1.02]' : 'hover:ring-2 hover:ring-[#4a4a4c] hover:scale-105'}`}
              >
                {/* Background (Gradient) */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#1c1c1e] to-[#0a0a0c]"></div>
                
                {/* Parallax Image / Pattern */}
                <div className="absolute inset-0 opacity-40 bg-center bg-cover transition-transform duration-1000 group-hover:scale-110" style={{ backgroundImage: "url('/hero-bg.png')" }}></div>
                
                {/* Overlay sombre */}
                <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors"></div>

                {/* Contenu */}
                <div className="absolute inset-0 flex flex-col items-center justify-center p-4">
                   <h3 className="text-3xl font-black text-white drop-shadow-[0_4px_8px_rgba(0,0,0,0.8)] uppercase tracking-widest text-center transition-transform group-hover:scale-110">
                      Paranoia<br/>{profile.minecraftVersion}
                   </h3>
                </div>

                {/* Bouton Favori */}
                <button 
                  onClick={(e) => { e.stopPropagation(); onFavorite(profile.id); }}
                  className={`absolute top-3 left-3 w-8 h-8 rounded-lg flex items-center justify-center bg-black/50 backdrop-blur-md border ${profile.favorite ? 'border-yellow-500/50 text-yellow-400' : 'border-[#2a2a2c] text-[#8888a0] opacity-0 group-hover:opacity-100'} hover:border-yellow-400 hover:text-yellow-400 transition-all`}
                >
                  <Star className={`w-4 h-4 ${profile.favorite ? 'fill-current' : ''}`} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* DROITE : Détails de la version sélectionnée */}
      {selectedProfile && (
        <div className="w-full lg:w-[360px] shrink-0 flex flex-col gap-4">
          <h2 className="text-xl font-black uppercase tracking-widest text-white mb-2">Selected Version</h2>
          
          {/* Card Info */}
          <div className="bg-[#151517] border border-[#2a2a2c] rounded-2xl p-5 flex flex-col gap-5 shadow-lg flex-1 overflow-y-auto scrollbar-hide">
             {/* Thumbnail */}
             <div className="w-full h-40 rounded-xl overflow-hidden relative shadow-inner">
               <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/hero-bg.png')" }}></div>
               <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent"></div>
               <div className="absolute bottom-3 left-3 right-3 text-[10px] font-bold text-white/50 tracking-widest uppercase">
                 {selectedProfile.profileTypeId} PROFILE
               </div>
             </div>
             
             {/* Titre */}
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#2a2a2c] flex items-center justify-center">
                  <Pickaxe className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-black text-white">{selectedProfile.name}</h3>
             </div>
             
             {/* Description */}
             <p className="text-xs text-[#8888a0] leading-relaxed">
               Profil de jeu configuré pour la version {selectedProfile.minecraftVersion} avec le chargeur {selectedProfile.profileTypeId}. Ce profil est prêt à être lancé.
             </p>
             
             {/* Badge Global */}
             <div className="bg-[#1c1c1e] text-xs font-bold text-[#10b981] px-4 py-3 rounded-xl flex items-center gap-3 shadow-inner border border-[#2a2a2c]">
               <div className="w-2 h-2 rounded-full bg-[#10b981]"></div>
               Using global .minecraft
             </div>
             
             {/* Détails */}
             <div className="flex items-center justify-between mt-2">
                <span className="text-sm font-bold text-[#e0e0e0]">Version</span>
                <div className="bg-[#1c1c1e] border border-[#2a2a2c] px-3 py-1.5 rounded-lg text-sm text-white font-medium shadow-inner">
                   {selectedProfile.minecraftVersion}
                </div>
             </div>
             
             <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-[#e0e0e0]">Addons</span>
                <div className="flex gap-2">
                   {/* Fake Addons Badges */}
                   <div className="w-7 h-7 rounded-md bg-[#c0392b] text-[10px] font-black text-white flex items-center justify-center shadow-lg border border-[#e74c3c]">
                     OF
                   </div>
                   <div className="w-7 h-7 rounded-md bg-[#1c1c1e] border border-[#2a2a2c] text-[12px] font-black text-[#8888a0] flex items-center justify-center cursor-pointer hover:bg-[#2a2a2c] transition-colors">
                     +
                   </div>
                </div>
             </div>
             
             {/* Boutons Actions (Supprimer / Lancer) */}
             <div className="flex gap-3 mt-auto pt-4">
                <button 
                  onClick={() => onDelete(selectedProfile.id)}
                  className="w-14 h-14 flex-shrink-0 bg-[#1c1c1e] hover:bg-red-500/20 text-[#8888a0] hover:text-red-500 rounded-xl flex items-center justify-center border border-[#2a2a2c] hover:border-red-500/50 transition-colors shadow-lg"
                  title="Paramètres"
                >
                  <Settings className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => alert(`Lancement de ${selectedProfile.name}`)}
                  className="flex-1 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl font-black text-lg shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_40px_rgba(16,185,129,0.4)] transition-all flex items-center justify-center gap-3 tracking-wide"
                >
                  LAUNCH GAME
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

import { Pickaxe, Plus, Star, Search, Settings, Play, Box } from "lucide-react";
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
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center bg-[#151517] rounded-xl px-4 py-3 w-1/2 border border-[#2a2a2c] shadow-inner">
             <Search className="w-5 h-5 text-[#4a4a4c] mr-3" />
             <input 
               type="text" 
               placeholder={t("profiles.search") || "Rechercher un profil..."} 
               className="bg-transparent border-none outline-none text-sm w-full text-white placeholder:text-[#4a4a4c]"
             />
          </div>
          <button 
            onClick={() => setIsCreatingProfile(!isCreatingProfile)}
            className="px-5 py-3 bg-accent-purple hover:bg-accent-purple-dark text-white text-sm font-bold rounded-xl shadow-[0_0_15px_rgba(157,13,242,0.3)] hover:shadow-[0_0_25px_rgba(157,13,242,0.5)] transition-all flex items-center gap-2 transform hover:-translate-y-1"
          >
            <Plus className="w-5 h-5" strokeWidth={3} />
            {isCreatingProfile ? t("profiles.cancel") : t("profiles.new")}
          </button>
        </div>

        {/* Grille */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-accent-purple/30 scrollbar-track-transparent pb-10">
          {profiles.map((profile) => {
            const isSelected = selectedProfileId === profile.id;
            return (
              <div 
                key={profile.id}
                onClick={() => setSelectedProfileId(profile.id)}
                className={`relative h-[160px] rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 ${isSelected ? 'ring-2 ring-accent-purple shadow-[0_0_30px_rgba(157,13,242,0.2)] scale-[1.02]' : 'border border-[#2a2a2c] hover:border-accent-purple/50 hover:scale-105'}`}
              >
                {/* Background Paranoia (Gradient subtil violet) */}
                <div className="absolute inset-0 bg-[#151517]"></div>
                <div className={`absolute inset-0 bg-gradient-to-br from-accent-purple/10 to-transparent opacity-0 transition-opacity duration-500 ${isSelected ? 'opacity-100' : 'group-hover:opacity-100'}`}></div>
                
                {/* Parallax Image / Pattern propre à Paranoia */}
                <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "20px 20px" }}></div>
                
                {/* Contenu */}
                <div className="absolute inset-0 flex flex-col p-5">
                   <div className="flex-1">
                     <h3 className={`text-xl font-black ${isSelected ? 'text-accent-purple' : 'text-white group-hover:text-accent-purple-light'} transition-colors truncate`}>
                        {profile.name}
                     </h3>
                     <p className="text-xs text-[#8888a0] font-medium mt-1">Version {profile.minecraftVersion}</p>
                   </div>
                   
                   <div className="flex justify-between items-end">
                     <div className="px-3 py-1 bg-black/40 rounded-lg text-xs font-bold text-[#e0e0e0] border border-[#2a2a2c]">
                       {profile.profileTypeId.toUpperCase()}
                     </div>
                   </div>
                </div>

                {/* Bouton Favori */}
                <button 
                  onClick={(e) => { e.stopPropagation(); onFavorite(profile.id); }}
                  className={`absolute bottom-5 right-5 w-8 h-8 rounded-lg flex items-center justify-center bg-black/50 backdrop-blur-md border ${profile.favorite ? 'border-yellow-500/50 text-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.2)]' : 'border-[#2a2a2c] text-[#4a4a4c] opacity-0 group-hover:opacity-100'} hover:border-yellow-400 hover:text-yellow-400 transition-all`}
                >
                  <Star className={`w-4 h-4 ${profile.favorite ? 'fill-current' : ''}`} />
                </button>
              </div>
            );
          })}
          
          {profiles.length === 0 && (
             <div className="col-span-full text-center py-20 bg-[#151517] border border-[#2a2a2c] rounded-2xl">
               <div className="w-20 h-20 bg-[#1c1c1e] rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                 <Box className="w-10 h-10 text-accent-purple" />
               </div>
               <h3 className="text-2xl font-bold text-white mb-3">{t("profiles.empty_title")}</h3>
               <p className="text-[#8888a0] mb-8 max-w-md mx-auto">{t("profiles.empty_subtitle") || "Vous n'avez pas encore configuré de profil de jeu."}</p>
               <button onClick={() => setIsCreatingProfile(true)} className="px-8 py-3 bg-accent-purple hover:bg-accent-purple-dark text-white font-black rounded-xl shadow-[0_0_20px_rgba(157,13,242,0.4)] transition-all transform hover:-translate-y-1">
                 {t("profiles.create_btn")}
               </button>
             </div>
          )}
        </div>
      </div>

      {/* DROITE : Détails de la version sélectionnée (Style Paranoia) */}
      {selectedProfile && (
        <div className="w-full lg:w-[380px] shrink-0 flex flex-col">
          
          {/* Card Info */}
          <div className="bg-[#151517] border border-[#2a2a2c] rounded-3xl p-6 flex flex-col gap-6 shadow-2xl flex-1 overflow-y-auto scrollbar-hide relative">
             {/* Déco */}
             <div className="absolute top-0 right-0 w-32 h-32 bg-accent-purple/10 rounded-full blur-3xl"></div>
             
             {/* Thumbnail / Header du profil */}
             <div className="w-full h-32 rounded-2xl overflow-hidden relative shadow-inner border border-[#2a2a2c]">
               <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: "url('/hero-bg.png')" }}></div>
               <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/60 to-transparent"></div>
               <div className="absolute bottom-4 left-4 flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-accent-purple/20 backdrop-blur-md border border-accent-purple/50 flex items-center justify-center shadow-[0_0_15px_rgba(157,13,242,0.3)]">
                   <Box className="w-5 h-5 text-white" />
                 </div>
                 <div>
                   <h3 className="text-xl font-black text-white leading-tight">{selectedProfile.name}</h3>
                   <p className="text-[10px] font-bold text-accent-purple tracking-widest uppercase">Configuration Active</p>
                 </div>
               </div>
             </div>
             
             {/* Description */}
             <p className="text-sm text-[#8888a0] leading-relaxed">
               Profil configuré sur la version <strong className="text-white">{selectedProfile.minecraftVersion}</strong> avec le chargeur de mods <strong className="text-white capitalize">{selectedProfile.profileTypeId}</strong>.
             </p>
             
             {/* Infos techniques */}
             <div className="space-y-3">
               <div className="flex items-center justify-between p-3 bg-[#0a0a0c] rounded-xl border border-[#2a2a2c]">
                  <span className="text-xs font-bold text-[#8888a0] uppercase tracking-wider">Moteur de jeu</span>
                  <div className="text-sm text-white font-medium">
                     Minecraft {selectedProfile.minecraftVersion}
                  </div>
               </div>
               
               <div className="flex items-center justify-between p-3 bg-[#0a0a0c] rounded-xl border border-[#2a2a2c]">
                  <span className="text-xs font-bold text-[#8888a0] uppercase tracking-wider">Mod Loader</span>
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-accent-purple animate-pulse"></div>
                     <span className="text-sm text-white font-medium capitalize">{selectedProfile.profileTypeId}</span>
                  </div>
               </div>

               <div className="flex items-center justify-between p-3 bg-[#0a0a0c] rounded-xl border border-[#2a2a2c]">
                  <span className="text-xs font-bold text-[#8888a0] uppercase tracking-wider">Dossier</span>
                  <div className="text-xs text-[#4a4a4c] font-mono">
                     Par défaut (.minecraft)
                  </div>
               </div>
             </div>
             
             {/* Boutons Actions (Supprimer / Lancer) */}
             <div className="flex gap-3 mt-auto pt-4">
                <button 
                  onClick={() => onDelete(selectedProfile.id)}
                  className="w-14 h-14 flex-shrink-0 bg-[#1c1c1e] hover:bg-accent-red/20 text-[#4a4a4c] hover:text-accent-red rounded-2xl flex items-center justify-center border border-[#2a2a2c] hover:border-accent-red/50 transition-all shadow-inner"
                  title="Supprimer ce profil"
                >
                  <Settings className="w-6 h-6" />
                </button>
                <button 
                  onClick={() => alert(`Lancement de ${selectedProfile.name}`)}
                  className="flex-1 bg-accent-purple hover:bg-accent-purple-dark text-white rounded-2xl font-black text-lg shadow-[0_0_20px_rgba(157,13,242,0.4)] hover:shadow-[0_0_35px_rgba(157,13,242,0.6)] transition-all flex items-center justify-center gap-3 tracking-wide transform hover:-translate-y-1 active:scale-95"
                >
                  <Play className="w-6 h-6 fill-current" />
                  JOUER MAINTENANT
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

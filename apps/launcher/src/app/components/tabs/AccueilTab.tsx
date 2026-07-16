import { Pickaxe, Play, Users, MessageSquare } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LauncherProfile, MicrosoftAccount, NewsItem } from "@paranoia/contracts";

type AccueilTabProps = {
  account: MicrosoftAccount | null;
  profiles: LauncherProfile[];
  connected: boolean;
  installState: string;
  news: NewsItem[];
  setSelectedProfileId: (id: string) => void;
  setActiveTab: (tab: "accueil" | "profils" | "parametres") => void;
};

export function AccueilTab({
  account,
  profiles,
  connected,
  installState,
  news,
  setSelectedProfileId,
  setActiveTab
}: AccueilTabProps) {
  const { t } = useTranslation();
  
  // Utiliser le dernier profil joué ou le premier de la liste
  const mainProfile = profiles.length > 0 ? profiles[0] : null;

  return (
    <div className="max-w-[1400px] w-full mx-auto animate-in fade-in duration-500 flex flex-col xl:flex-row gap-8">
      
      {/* COLONNE GAUCHE (Contenu Principal) */}
      <div className="flex-1 flex flex-col gap-6 overflow-hidden">
        
        {/* En-tête / Bienvenue */}
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 rounded-full overflow-hidden bg-[#1c1c1e] border border-[#2a2a2c] flex-shrink-0 shadow-lg">
              <img 
                src={`https://minotar.net/helm/${account?.minecraftUsername || 'Steve'}/64`} 
                alt="Avatar" 
                className="w-full h-full object-cover"
              />
           </div>
           <h1 className="text-lg font-bold text-white tracking-wide">
             {t("home.welcome")} <span className="text-accent-purple font-black">{account?.minecraftUsername || t("home.guest")}</span>
           </h1>
        </div>

        {/* HERO BANNER (Profil principal) */}
        <div className="relative w-full h-[380px] rounded-2xl overflow-hidden shadow-2xl border border-[#2a2a2c] flex flex-col items-center justify-center group bg-[#0a0a0c]">
          {/* Image de fond générée */}
          <div className="absolute inset-0 bg-cover bg-center transition-transform duration-[15s] group-hover:scale-110" style={{ backgroundImage: "url('/hero-bg.png')" }}></div>
          <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-black/30 to-transparent"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-transparent to-black/80"></div>
          
          {/* Action Principale */}
          <div className="relative z-10 flex flex-col items-center justify-end h-full pb-10 w-full">
            {mainProfile ? (
              <>
                <button 
                  onClick={() => { setSelectedProfileId(mainProfile.id); alert(`${t("home.launching")} ${mainProfile.name}`); }}
                  disabled={!connected || installState === "running"}
                  className="bg-[#10b981] hover:bg-[#059669] text-white px-16 py-4 rounded-xl text-2xl font-black shadow-[0_0_40px_rgba(16,185,129,0.25)] hover:shadow-[0_0_60px_rgba(16,185,129,0.4)] transition-all transform hover:-translate-y-1 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 uppercase tracking-wider"
                >
                  <Play className="w-7 h-7 fill-current" />
                  {t("home.play")}
                </button>
                <div className="mt-6 bg-black/50 backdrop-blur-md px-5 py-2 rounded-full border border-white/10 flex items-center gap-2 shadow-lg">
                  <Pickaxe className="w-4 h-4 text-[#10b981]" />
                  <span className="text-sm font-bold text-[#e0e0e0]">
                    Paranoia Client {mainProfile.minecraftVersion} <span className="text-[#8888a0] font-normal mx-1">avec</span> <span className="text-[#10b981]">{mainProfile.profileTypeId.toUpperCase()}</span>
                  </span>
                </div>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setActiveTab("profils")}
                  className="bg-white hover:bg-gray-200 text-black px-12 py-4 rounded-xl text-xl font-black shadow-[0_0_30px_rgba(255,255,255,0.2)] hover:shadow-[0_0_50px_rgba(255,255,255,0.4)] transition-all transform hover:-translate-y-1 active:scale-95 uppercase tracking-wider"
                >
                  {t("home.create_profile")}
                </button>
                <p className="mt-6 text-[#8888a0] text-sm bg-black/60 backdrop-blur-md px-4 py-2 rounded-full border border-white/10">
                  Aucun profil trouvé. Forge le tien pour commencer.
                </p>
              </>
            )}
          </div>
        </div>

        {/* BARRE DES AUTRES PROFILS */}
        {profiles.length > 1 && (
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {profiles.slice(1).map(p => (
              <div 
                key={p.id} 
                onClick={() => setSelectedProfileId(p.id)} 
                className="w-16 h-16 shrink-0 bg-[#151517] border border-[#2a2a2c] hover:border-accent-purple rounded-xl cursor-pointer flex flex-col items-center justify-center transition-all hover:scale-105 hover:bg-[#1c1c1e] shadow-lg group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-accent-purple/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <Pickaxe className="w-6 h-6 text-[#4a4a4c] group-hover:text-accent-purple mb-1 transition-colors" />
                <span className="text-[9px] font-bold text-[#8888a0] group-hover:text-white uppercase">{p.minecraftVersion}</span>
              </div>
            ))}
          </div>
        )}

        {/* LATEST NEWS (Scroll horizontal) */}
        <div className="mt-2">
          <h2 className="text-sm font-black text-[#8888a0] mb-4 uppercase tracking-wider">{t("home.discover")} <span className="text-[10px] ml-2 bg-[#2a2a2c] text-white px-2 py-0.5 rounded-full">{news.length} unread</span></h2>
          <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-[#2a2a2c] scrollbar-track-transparent">
            {news.map((item, idx) => (
              <div key={idx} className="min-w-[340px] w-[340px] h-[190px] bg-[#151517] border border-[#2a2a2c] rounded-xl overflow-hidden group cursor-pointer relative shadow-lg hover:border-[#4a4a4c] transition-all hover:-translate-y-1">
                 <div className="absolute inset-0 opacity-[0.1]" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "16px 16px" }}></div>
                 <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/80 to-transparent z-0"></div>
                 <div className="absolute -top-10 -right-10 w-32 h-32 bg-accent-purple/10 rounded-full blur-3xl group-hover:bg-accent-purple/30 transition-all"></div>
                 
                 <div className="absolute top-4 left-4 z-10 flex gap-2">
                    <span className="px-2 py-1 bg-accent-red text-white text-[9px] font-bold uppercase rounded shadow-md tracking-wider">
                      {t("home.news_badge")}
                    </span>
                    <span className="px-2 py-1 bg-[#1c1c1e] text-[#10b981] border border-[#2a2a2c] text-[9px] font-bold uppercase rounded shadow-md tracking-wider">
                      UPDATE
                    </span>
                 </div>
                 
                 <div className="absolute bottom-0 left-0 right-0 p-5 z-10">
                   <h3 className="text-xl font-black text-white group-hover:text-accent-purple transition-colors truncate">{item.title}</h3>
                   <p className="text-[#8888a0] text-xs line-clamp-2 mt-2 leading-relaxed">{item.excerpt}</p>
                 </div>
              </div>
            ))}
            {news.length === 0 && (
               <div className="min-w-[340px] h-[190px] bg-[#151517]/50 border border-[#2a2a2c] border-dashed rounded-xl flex items-center justify-center">
                 <p className="text-[#8888a0] text-sm font-medium">Rien de neuf sous le soleil.</p>
               </div>
            )}
          </div>
        </div>

      </div>

      {/* COLONNE DROITE (Sidebar sociale & infos) */}
      <div className="w-full xl:w-80 shrink-0 flex flex-col gap-6">
        
        {/* Panneau Amis */}
        <div className="bg-[#151517] border border-[#2a2a2c] rounded-2xl p-5 shadow-lg flex-1 min-h-[300px] flex flex-col">
          <h2 className="text-sm font-black text-white mb-4 uppercase tracking-wider flex items-center justify-between">
            Amis <span className="text-[10px] bg-[#2a2a2c] px-2 py-0.5 rounded text-[#8888a0] font-bold">0 online</span>
          </h2>
          <div className="flex-1 border border-[#2a2a2c] border-dashed rounded-xl flex flex-col items-center justify-center text-center p-6 bg-[#0a0a0c]/50">
             <Users className="w-10 h-10 text-[#2a2a2c] mb-3" />
             <p className="text-sm text-[#8888a0] font-medium">Personne en ligne pour le moment.</p>
             <p className="text-[10px] text-[#4a4a4c] mt-2 uppercase tracking-widest">Connecte-toi pour inviter</p>
          </div>
        </div>

        {/* Panneau Discord */}
        <div className="bg-gradient-to-br from-[#5865F2]/20 to-[#151517] border border-[#5865F2]/30 rounded-2xl p-6 relative overflow-hidden group cursor-pointer shadow-lg hover:border-[#5865F2]/60 transition-all duration-300 transform hover:-translate-y-1">
           <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-[#5865F2]/20 rounded-full blur-3xl group-hover:bg-[#5865F2]/40 transition-all duration-500"></div>
           <MessageSquare className="w-8 h-8 text-[#5865F2] mb-4 relative z-10 group-hover:scale-110 transition-transform" />
           <h3 className="text-xl font-black text-white mb-2 relative z-10">Rejoins le Discord</h3>
           <p className="text-xs text-[#8888a0] relative z-10 leading-relaxed">Viens discuter avec la communauté, trouver des coéquipiers et suivre les annonces.</p>
           
           <div className="mt-5 flex items-center gap-2 text-[#5865F2] text-xs font-bold uppercase tracking-wider relative z-10 group-hover:translate-x-2 transition-transform duration-300">
             Rejoindre le serveur <span className="text-lg leading-none">›</span>
           </div>
        </div>

      </div>

    </div>
  );
}

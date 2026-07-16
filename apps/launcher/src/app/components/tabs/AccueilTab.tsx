import { Pickaxe, Play } from "lucide-react";
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

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      
      <div>
        <h1 className="text-3xl font-black font-outfit text-white mb-1">
          {t("home.welcome")} <span className="text-accent-purple">{account?.minecraftUsername || t("home.guest")}</span>
        </h1>
        <p className="text-[#8888a0] font-medium text-sm">{t("home.jumpBackIn")}</p>
      </div>

      {/* RECENT PROFILES (Jump back in) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {profiles.length > 0 ? (
          profiles.slice(0, 4).map(p => (
            <div key={p.id} className="bg-[#1c1c1e]/90 backdrop-blur-md border border-[#2a2a2c] p-4 rounded-xl flex flex-col justify-between group hover:border-[#4a4a4c] transition-all relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-accent-purple/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-accent-purple/20 transition-all"></div>
              
              <div className="flex items-start justify-between mb-6 relative z-10">
                <div className="w-10 h-10 bg-[#111111] rounded-lg border border-[#2a2a2c] flex items-center justify-center">
                  <Pickaxe className="w-5 h-5 text-[#8888a0]" />
                </div>
                <span className="text-[10px] uppercase font-bold text-white/50 bg-black/50 px-2 py-1 rounded">
                  {p.minecraftVersion}
                </span>
              </div>
              
              <div className="relative z-10 mb-4">
                <h3 className="font-black text-white text-lg truncate">{p.name}</h3>
                <p className="text-xs text-accent-purple font-bold mt-1">{p.profileTypeId.toUpperCase()}</p>
              </div>

              <button 
                onClick={() => { setSelectedProfileId(p.id); alert(`${t("home.launching")} ${p.name}`); }}
                disabled={!connected || installState === "running"}
                className="w-full py-2.5 bg-[#111111] group-hover:bg-accent-purple text-white border border-[#2a2a2c] group-hover:border-accent-purple font-bold rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed z-10 relative"
              >
                <Play className="w-4 h-4 fill-current" />
                {t("home.play")}
              </button>
            </div>
          ))
        ) : (
          <div className="md:col-span-2 lg:col-span-4 relative bg-[#151517] border border-[#2a2a2c] p-12 rounded-xl flex flex-col items-center justify-center text-center overflow-hidden group">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-accent-purple/5 rounded-full blur-[80px] group-hover:bg-accent-purple/15 transition-all duration-700"></div>
            
            <div className="w-16 h-16 bg-[#1c1c1e] rounded-2xl border border-[#2a2a2c] flex items-center justify-center mb-5 relative z-10 shadow-lg group-hover:scale-110 group-hover:-translate-y-2 transition-all duration-500">
              <Pickaxe className="w-8 h-8 text-[#8888a0] group-hover:text-accent-purple transition-colors duration-500" />
            </div>
            
            <h3 className="text-2xl font-black text-white mb-2 relative z-10">{t("home.no_profiles")}</h3>
            <p className="text-[#8888a0] mb-8 max-w-sm relative z-10 text-sm">Commence par forger ton premier profil pour pouvoir lancer le jeu avec tes propres paramètres.</p>
            
            <button 
              onClick={() => setActiveTab("profils")}
              className="relative z-10 px-8 py-3 bg-white text-black font-black rounded-lg hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)]"
            >
              {t("home.create_profile")}
            </button>
          </div>
        )}
      </div>

      {/* NEWS & DISCOVER */}
      <div>
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">{t("home.discover")} <span className="text-accent-purple text-sm">›</span></h2>
        <div className="grid grid-cols-1 gap-6">
          {/* Big News */}
          <div className="bg-[#1c1c1e]/90 backdrop-blur-md border border-[#2a2a2c] rounded-xl overflow-hidden group cursor-pointer relative shadow-[inset_0_2px_15px_rgba(0,0,0,0.5)] flex flex-col min-h-[300px]">
            <div className="flex-1 bg-[#0a0a0c] relative flex items-center justify-center overflow-hidden">
               {/* Grille pointillée */}
               <div className="absolute inset-0 opacity-[0.15]" style={{ backgroundImage: "radial-gradient(#ffffff 1px, transparent 1px)", backgroundSize: "24px 24px" }}></div>
               <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0c]"></div>
               <div className="absolute top-0 right-0 w-96 h-96 bg-accent-purple/10 rounded-full blur-[100px]"></div>
               
               <Pickaxe className="w-20 h-20 text-[#1c1c1e] group-hover:text-accent-purple/40 transition-colors duration-700 z-10 drop-shadow-2xl relative group-hover:scale-110" />
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/90 to-transparent">
              <div className="mb-3 transform translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                <span className="px-3 py-1 bg-accent-red text-white text-[10px] font-bold uppercase rounded shadow-[0_0_15px_rgba(239,68,68,0.3)] tracking-wider">
                  {t("home.news_badge")}
                </span>
              </div>
              <h3 className="text-3xl font-black text-white mb-2 group-hover:text-accent-purple transition-colors transform translate-y-2 group-hover:translate-y-0 duration-300 delay-75">
                {news[0]?.title || "Saison 3 : L'Éveil"}
              </h3>
              <p className="text-[#8888a0] text-sm line-clamp-2 max-w-2xl transform translate-y-2 group-hover:translate-y-0 duration-300 delay-100">
                {news[0]?.excerpt || "La nouvelle saison arrive avec son lot de nouveautés, de nouveaux biomes et un gameplay repensé."}
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}

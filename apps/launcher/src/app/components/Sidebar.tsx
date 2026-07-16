import { Home, Sword, Wrench, Pickaxe } from "lucide-react";
import { useTranslation } from "react-i18next";

type SidebarProps = {
  activeTab: "accueil" | "profils" | "parametres";
  setActiveTab: (tab: "accueil" | "profils" | "parametres") => void;
};

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="w-20 bg-[#050505] border-r border-[#1a1a1a] flex flex-col items-center z-20 shadow-[4px_0_24px_rgba(168,85,247,0.05)] py-6 shrink-0">
      <div className="w-12 h-12 bg-accent-purple/20 rounded-xl border border-accent-purple/30 flex items-center justify-center mb-8 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
        <Pickaxe className="w-7 h-7 text-accent-purple" strokeWidth={2.5} />
      </div>

      <nav className="flex-1 w-full px-3 space-y-3">
        <button 
          onClick={() => setActiveTab("accueil")}
          title={t("sidebar.home")}
          className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all duration-200 ${activeTab === 'accueil' ? 'bg-[#111111] text-white ring-1 ring-[#2a2a2a] shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'text-[#8888a0] hover:bg-[#0a0a0a] hover:text-white'}`}
        >
          <Home className="w-6 h-6" strokeWidth={2.5} />
        </button>
        
        <button 
          onClick={() => setActiveTab("profils")}
          title={t("sidebar.profiles")}
          className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all duration-200 ${activeTab === 'profils' ? 'bg-[#111111] text-white ring-1 ring-[#2a2a2a] shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'text-[#8888a0] hover:bg-[#0a0a0a] hover:text-white'}`}
        >
          <Sword className="w-6 h-6" strokeWidth={2.5} />
        </button>
        
        <button 
          onClick={() => setActiveTab("parametres")}
          title={t("sidebar.settings")}
          className={`w-full aspect-square flex items-center justify-center rounded-xl transition-all duration-200 ${activeTab === 'parametres' ? 'bg-[#111111] text-white ring-1 ring-[#2a2a2a] shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'text-[#8888a0] hover:bg-[#0a0a0a] hover:text-white'}`}
        >
          <Wrench className="w-6 h-6" strokeWidth={2.5} />
        </button>
      </nav>
    </aside>
  );
}

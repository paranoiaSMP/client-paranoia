import { Home, Gamepad2, Package, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";

type SidebarProps = {
  activeTab: "accueil" | "profils" | "mods" | "parametres";
  setActiveTab: (tab: "accueil" | "profils" | "mods" | "parametres") => void;
};

const tabs = [
  { id: "accueil" as const, icon: Home, labelKey: "sidebar.home" },
  { id: "profils" as const, icon: Gamepad2, labelKey: "sidebar.profiles" },
  { id: "mods" as const, icon: Package, labelKey: "sidebar.mods" },
  { id: "parametres" as const, icon: Settings, labelKey: "sidebar.settings" },
];

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="w-16 bg-[#0c0c0e] border-r border-[#1a1a1c] flex flex-col items-center py-4 shrink-0">
      
      {/* Logo */}
      <div className="w-9 h-9 bg-accent-purple rounded-lg flex items-center justify-center mb-6 text-white font-black text-sm">
        P
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1 w-full px-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={t(tab.labelKey)}
              className={`w-full aspect-square rounded-lg flex items-center justify-center transition-colors ${
                active 
                  ? 'bg-[#1a1529] text-white' 
                  : 'text-[#463a70] hover:text-[#9a92b6] hover:bg-[#1a1529]/50'
              }`}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </nav>

      {/* Paramètres en bas */}
    </aside>
  );
}

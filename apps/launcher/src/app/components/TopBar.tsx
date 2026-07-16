import { User } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MicrosoftAccount } from "@paranoia/contracts";

type TopBarProps = {
  connected: boolean;
  account: MicrosoftAccount | null;
  connectingMicrosoft: boolean;
  onConnectMicrosoft: () => void;
  onLocalDevContinue: () => void;
};

export function TopBar({
  connected,
  account,
  connectingMicrosoft,
  onConnectMicrosoft,
  onLocalDevContinue
}: TopBarProps) {
  const { t } = useTranslation();

  return (
    <header className="h-20 flex items-center justify-between px-8 bg-[#050505]/80 backdrop-blur-md border-b border-[#1a1a1a] shrink-0">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-black font-outfit tracking-tight text-white drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
          PARANOIA<span className="text-accent-purple text-xs align-top font-bold ml-1">SMP</span>
        </h1>
      </div>
      
      <div className="flex items-center gap-4">
        {connected ? (
          <div className="flex items-center gap-3 bg-[#111111] border border-[#2a2a2c] px-4 py-2 rounded-full shadow-inner">
            <span className="font-bold text-sm">{account?.minecraftUsername}</span>
            <div className="w-8 h-8 rounded-full bg-[#1c1c1e] border border-[#2a2a2c] flex items-center justify-center overflow-hidden">
              <User className="w-4 h-4 text-white/80" strokeWidth={2} />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button 
              onClick={onLocalDevContinue}
              className="px-3 py-1.5 text-xs text-[#8888a0] hover:text-white transition-colors uppercase font-bold"
            >
              {t("topbar.devMode")}
            </button>
            <button 
              onClick={onConnectMicrosoft} 
              disabled={connectingMicrosoft}
              className="px-6 py-2 bg-accent-purple hover:bg-accent-purple-dark text-white rounded-full transition-all text-sm font-bold shadow-[0_0_15px_rgba(168,85,247,0.3)]"
            >
              {connectingMicrosoft ? t("topbar.connecting") : t("topbar.connect")}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

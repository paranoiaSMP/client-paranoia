import { useState } from "react";
import { User, ChevronDown, LogOut, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MicrosoftAccount } from "@paranoia/contracts";

type TopBarProps = {
  connected: boolean;
  account: MicrosoftAccount | null;
  accounts: MicrosoftAccount[];
  connectingMicrosoft: boolean;
  onConnectMicrosoft: () => void;
  onLocalDevContinue: () => void;
  onSwitchAccount: (account: MicrosoftAccount) => void;
  onLogout: () => void;
};

export function TopBar({
  connected,
  account,
  accounts,
  connectingMicrosoft,
  onConnectMicrosoft,
  onLocalDevContinue,
  onSwitchAccount,
  onLogout,
}: TopBarProps) {
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);

  /*
   * BARRE SUPERIEURE (TOPBAR)
   * Affiche le logo de l'application et gere l'interface utilisateur d'authentification.
   * Contient le menu deroulant pour la gestion des comptes (changement, ajout, deconnexion).
   */
  return (
    <header className="h-14 flex items-center justify-between px-6 bg-[#0c0c0e] border-b border-[#1a1a1c] shrink-0">
      <h1 className="text-lg font-black text-white">
        PARANOIA
        <span className="text-accent-purple text-[10px] align-top ml-1">
          CLIENT
        </span>
      </h1>

      <div className="flex items-center gap-3">
        {connected && account ? (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 bg-[#18181b] border border-[#27272a] px-3 py-1.5 rounded-lg hover:border-[#3f3f46] transition-colors"
            >
              <img
                src={`https://minotar.net/helm/${account.minecraftUsername}/24`}
                alt=""
                className="w-6 h-6 rounded"
              />
              <span className="text-white text-sm font-semibold">
                {account.minecraftUsername}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-[#71717a] transition-transform ${menuOpen ? "rotate-180" : ""}`}
              />
            </button>

            {menuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                ></div>
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#18181b] border border-[#27272a] rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-[#27272a]">
                    <p className="text-[10px] text-[#52525b] uppercase tracking-wider mb-2">
                      Compte actif
                    </p>
                    <div className="flex items-center gap-3">
                      <img
                        src={`https://minotar.net/helm/${account.minecraftUsername}/32`}
                        alt=""
                        className="w-8 h-8 rounded-lg"
                      />
                      <div>
                        <p className="text-white text-sm font-bold">
                          {account.minecraftUsername}
                        </p>
                        <p className="text-[#52525b] text-[10px] font-mono">
                          {account.minecraftUuid.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </div>

                  {accounts.filter((a) => a.id !== account.id).length > 0 && (
                    <div className="p-2 border-b border-[#27272a]">
                      <p className="text-[10px] text-[#52525b] uppercase tracking-wider px-1 mb-1">
                        Autres comptes
                      </p>
                      {accounts
                        .filter((a) => a.id !== account.id)
                        .map((a) => (
                          <button
                            key={a.id}
                            onClick={() => {
                              onSwitchAccount(a);
                              setMenuOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#27272a] transition-colors"
                          >
                            <img
                              src={`https://minotar.net/helm/${a.minecraftUsername}/24`}
                              alt=""
                              className="w-6 h-6 rounded"
                            />
                            <span className="text-[#a1a1aa] text-sm">
                              {a.minecraftUsername}
                            </span>
                          </button>
                        ))}
                    </div>
                  )}

                  <div className="p-2">
                    <button
                      onClick={() => {
                        onConnectMicrosoft();
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[#27272a] transition-colors text-[#a1a1aa] text-sm"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter un compte
                    </button>
                    <button
                      onClick={() => {
                        onLogout();
                        setMenuOpen(false);
                      }}
                      className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-red-900/30 transition-colors text-red-400 text-sm"
                    >
                      <LogOut className="w-4 h-4" />
                      Se déconnecter
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={onLocalDevContinue}
              className="px-3 py-1.5 text-xs text-[#52525b] hover:text-white transition-colors"
            >
              {t("topbar.devMode")}
            </button>
            <button
              onClick={onConnectMicrosoft}
              disabled={connectingMicrosoft}
              className="px-5 py-2 bg-accent-purple hover:bg-accent-purple-dark disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
            >
              <User className="w-4 h-4" />
              {connectingMicrosoft
                ? t("topbar.connecting")
                : t("topbar.connect")}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

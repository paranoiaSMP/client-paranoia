import { Plus, User, Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MicrosoftAccount } from "@paranoia/contracts";

type ComptesTabProps = {
  account: MicrosoftAccount | null;
  accounts: MicrosoftAccount[];
  connectingMicrosoft: boolean;
  onConnectMicrosoft: () => void;
  onSwitchAccount: (account: MicrosoftAccount) => void;
};

export function ComptesTab({
  account,
  accounts,
  connectingMicrosoft,
  onConnectMicrosoft,
  onSwitchAccount,
}: ComptesTabProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white uppercase tracking-wider">
            Vos Comptes
          </h3>
          <button
            onClick={onConnectMicrosoft}
            disabled={connectingMicrosoft}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#2a2a2a] hover:bg-[#333] disabled:opacity-50 text-white rounded-lg text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {connectingMicrosoft ? "Connexion..." : "Ajouter un compte"}
          </button>
        </div>

        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-2">
          {accounts.map((a) => {
            const isActive = account?.id === a.id;
            return (
              <div
                key={a.id}
                className={`flex items-center justify-between p-3 rounded-xl border-2 transition-colors ${
                  isActive
                    ? "border-accent-purple bg-accent-purple/10"
                    : "border-[#333] bg-[#212121] hover:border-[#444]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={`https://minotar.net/helm/${a.minecraftUsername}/48`}
                    alt={a.minecraftUsername}
                    className="w-10 h-10 rounded-lg bg-[#111]"
                  />
                  <div className="flex flex-col">
                    <span className="text-white font-medium">
                      {a.minecraftUsername}
                    </span>
                    <span className="text-[#a1a1aa] text-xs font-mono">
                      {a.minecraftUuid.slice(0, 8)}...
                    </span>
                  </div>
                </div>
                
                {isActive ? (
                  <div className="flex items-center gap-2 text-accent-purple bg-accent-purple/20 px-3 py-1 rounded-full text-xs font-medium">
                    <Check className="w-3.5 h-3.5" />
                    Actif
                  </div>
                ) : (
                  <button
                    onClick={() => onSwitchAccount(a)}
                    className="px-4 py-1.5 bg-[#333] hover:bg-[#444] text-white text-xs font-medium rounded-lg transition-colors"
                  >
                    Utiliser
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

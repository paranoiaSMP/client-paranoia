import { Loader2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { UpdateState } from "../hooks/useUpdater";

type UpdateModalProps = {
  state: UpdateState;
  onInstall: () => void;
  onDismiss: () => void;
};

export function UpdateModal({ state, onInstall, onDismiss }: UpdateModalProps) {
  const { t } = useTranslation();

  if (state.status === "idle") {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-[480px] rounded-2xl border-2 border-[#8b5cf6] bg-[#1e1832] p-8 shadow-2xl flex flex-col gap-6">
        
        {/* HEADER */}
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-mono font-bold tracking-widest text-white uppercase">
            UPDATE {state.status === "available" ? state.version : "..."}
          </h2>
          
          <div className="text-sm text-gray-300 min-h-[60px] max-h-[150px] overflow-y-auto">
            {state.status === "available" && (
              <div className="whitespace-pre-wrap font-medium">
                {state.notes || t("update.description_fallback", "DESCRIPTION UPDATE")}
              </div>
            )}
            {state.status === "downloading" && (
              <div className="flex items-center gap-3 text-accent-purple">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t("update.downloading", "Téléchargement en cours...")} {state.percent}%</span>
              </div>
            )}
            {state.status === "ready" && (
              <div className="text-white">
                {t("update.ready", "Prêt à installer")}
              </div>
            )}
            {state.status === "error" && (
              <div className="flex items-center gap-2 text-accent-red">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span className="truncate">{t("update.failed", "Erreur :")} {state.message}</span>
              </div>
            )}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center justify-center gap-4 pt-4">
          {state.status === "available" && (
            <>
              <button
                onClick={onDismiss}
                className="px-8 py-2.5 rounded-full bg-[#4b4166] hover:bg-[#666] text-white text-sm font-medium transition-colors min-w-[120px]"
              >
                {t("update.ignore", "Ignorer")}
              </button>
              
              <button
                onClick={onInstall}
                className="px-8 py-2.5 rounded-full bg-[#3a3a3a] hover:bg-[#3d3358] text-white text-sm font-medium transition-colors min-w-[120px]"
              >
                {t("update.install", "Installer")}
              </button>
            </>
          )}

          {state.status === "error" && (
            <button
              onClick={onDismiss}
              className="px-8 py-2.5 rounded-full bg-[#4b4166] hover:bg-[#666] text-white text-sm font-medium transition-colors"
            >
              Fermer
            </button>
          )}
        </div>

      </div>
    </div>
  );
}

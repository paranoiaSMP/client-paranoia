import { Loader2, AlertTriangle, ExternalLink } from "lucide-react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { invoke } from "@tauri-apps/api/core";
import type { UpdateState } from "../hooks/useUpdater";

type UpdateModalProps = {
  state: UpdateState;
  onInstall: () => void;
  onDismiss: () => void;
};

export function UpdateModal({ state, onInstall, onDismiss }: UpdateModalProps) {
  const { t } = useTranslation();

  useEffect(() => {
    if (state.status === "idle") return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onDismiss();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [state.status, onDismiss]);

  if (state.status === "idle") {
    return null;
  }

  const openLink = (url: string) => {
    invoke("open_external_url", { url }).catch(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-[500px] rounded-2xl border border-divider bg-surface p-7 shadow-2xl flex flex-col gap-6 text-neutral-200">
        
        {/* HEADER */}
        <div className="flex flex-col gap-2.5">
          <h2 className="text-lg font-mono font-bold tracking-wider text-ink uppercase">
            UPDATE {state.status === "available" ? state.version : ""}
          </h2>
          
          <div className="text-sm min-h-[60px] max-h-[180px] overflow-y-auto pr-1">
            {state.status === "available" && (
              <div className="whitespace-pre-wrap font-medium text-neutral-300 leading-relaxed">
                {state.notes || t("update.description_fallback", "Nouvelle version disponible.")}
              </div>
            )}
            {state.status === "downloading" && (
              <div className="flex items-center gap-3 text-accent py-4">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{t("update.downloading", "Téléchargement en cours...")} {state.percent}%</span>
              </div>
            )}
            {state.status === "ready" && (
              <div className="text-ink py-4 font-medium">
                {t("update.ready", "Prêt à installer, redémarrage...")}
              </div>
            )}
            {state.status === "error" && (
              <div className="flex items-start gap-3 py-1 text-danger">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-danger" />
                <div className="flex flex-col gap-1 text-xs sm:text-sm">
                  <span className="font-semibold text-danger">{t("update.failed", "Mise à jour impossible :")}</span>
                  <span className="text-neutral-300 leading-relaxed">{state.message}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-divider">
          {state.status === "available" && (
            <>
              <button
                type="button"
                onClick={onDismiss}
                className="px-5 py-2 rounded-xl bg-well hover:bg-neutral-800 text-neutral-300 hover:text-ink text-xs sm:text-sm font-medium transition-colors border border-divider"
              >
                {t("update.ignore", "Ignorer")}
              </button>
              
              <button
                type="button"
                onClick={onInstall}
                className="px-6 py-2 rounded-xl bg-accent hover:bg-accent/90 text-accent-100 text-xs sm:text-sm font-semibold transition-all shadow-sm"
              >
                {t("update.install", "Installer")}
              </button>
            </>
          )}

          {state.status === "error" && (
            <>
              <button
                type="button"
                onClick={onDismiss}
                className="px-5 py-2 rounded-xl bg-well hover:bg-neutral-800 text-neutral-300 hover:text-ink text-xs sm:text-sm font-medium transition-colors border border-divider"
              >
                {t("update.close", "Fermer")}
              </button>

              {state.downloadUrl && (
                <button
                  type="button"
                  onClick={() => openLink(state.downloadUrl!)}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-accent hover:bg-accent/90 text-accent-100 text-xs sm:text-sm font-semibold transition-all shadow-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{t("update.download_manual", "Télécharger la mise à jour")}</span>
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}

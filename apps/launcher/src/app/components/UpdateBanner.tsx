import { Download, X, Loader2, AlertTriangle } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { UpdateState } from "../hooks/useUpdater";

type UpdateBannerProps = {
  state: UpdateState;
  onInstall: () => void;
  onDismiss: () => void;
};

export function UpdateBanner({
  state,
  onInstall,
  onDismiss,
}: UpdateBannerProps) {
  const { t } = useTranslation();

  if (state.status === "idle") {
    return null;
  }

  return (
    <div className="shrink-0 bg-accent-purple/10 border-b border-accent-purple/30 px-6 py-2.5 flex items-center gap-3">
      {state.status === "downloading" ? (
        <Loader2 className="w-4 h-4 text-accent-purple animate-spin shrink-0" />
      ) : state.status === "error" ? (
        <AlertTriangle className="w-4 h-4 text-accent-red shrink-0" />
      ) : (
        <Download className="w-4 h-4 text-accent-purple shrink-0" />
      )}

      <div className="flex-1 min-w-0">
        {state.status === "available" && (
          <p className="text-sm text-white">
            {t("update.available", { version: state.version })}
          </p>
        )}
        {state.status === "downloading" && (
          <p className="text-sm text-white">
            {t("update.downloading")} {state.percent}%
          </p>
        )}
        {state.status === "ready" && (
          <p className="text-sm text-white">{t("update.ready")}</p>
        )}
        {state.status === "error" && (
          <p className="text-sm text-[#a1a1aa] truncate">
            {t("update.failed")} {state.message}
          </p>
        )}
      </div>

      {state.status === "available" && (
        <>
          <button
            onClick={onInstall}
            className="shrink-0 px-4 py-1.5 bg-accent-purple hover:bg-accent-purple-dark text-white text-xs font-semibold rounded-lg transition-colors"
          >
            {t("update.install")}
          </button>
          <button
            onClick={onDismiss}
            title={t("update.later")}
            className="shrink-0 p-1 text-[#71717a] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </>
      )}

      {state.status === "error" && (
        <button
          onClick={onDismiss}
          className="shrink-0 p-1 text-[#71717a] hover:text-white transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

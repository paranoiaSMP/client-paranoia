import { useEffect, useState } from "react";
import { AlertTriangle, Bug, CheckCircle2, Loader2, Send, X } from "lucide-react";
import type { LauncherProfile, MicrosoftAccount } from "@paranoia/contracts";
import { sendBugReport } from "../../shared/api/bugReportClient";
import { getGameLogs } from "../../shared/api/launcherClient";

type BugReportModalProps = {
  isOpen: boolean;
  onClose: () => void;
  account: MicrosoftAccount | null;
  profile: LauncherProfile | null;
  ramMaxMb?: number | null | undefined;
  launcherVersion?: string | undefined;
  initialCategory?: string | undefined;
  initialDescription?: string | undefined;
};

const CATEGORIES = [
  "Crash au lancement / en jeu",
  "Problème visuel / Interface",
  "Performance / Lags",
  "Autre problème",
];

function getGpuInfo(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) return "Inconnu";
    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return "Inconnu";
    return gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || "Inconnu";
  } catch {
    return "Inconnu";
  }
}

export function BugReportModal({
  isOpen,
  onClose,
  account,
  profile,
  ramMaxMb,
  launcherVersion = "0.7.18",
  initialCategory,
  initialDescription,
}: BugReportModalProps) {
  const [category, setCategory] = useState(
    initialCategory || CATEGORIES[0],
  );
  const [title, setTitle] = useState(
    initialCategory === "Crash" ? "Crash détecté au lancement" : "",
  );
  const [description, setDescription] = useState(initialDescription || "");
  const [attachLogs, setAttachLogs] = useState(true);
  const [detectedLogs, setDetectedLogs] = useState<string[]>([]);
  const [gpuInfo, setGpuInfo] = useState<string>("Inconnu");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setGpuInfo(getGpuInfo());
      if (initialCategory) setCategory(initialCategory);
      if (initialDescription) setDescription(initialDescription);
      if (initialCategory === "Crash" && !title) {
        setTitle("Crash détecté au lancement");
      }
      getGameLogs()
        .then((res) => setDetectedLogs(res.logs))
        .catch(() => setDetectedLogs([]));
    } else {
      setError(null);
      setSuccessMessage(null);
    }
  }, [isOpen, initialCategory, initialDescription]);

  if (!isOpen) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      setError("Merci de remplir le titre et la description.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let logsToSend: string | undefined;
      if (attachLogs) {
        const latest = await getGameLogs().catch(() => ({ logs: detectedLogs }));
        logsToSend = latest.logs.slice(-200).join("\n");
      }

      const res = await sendBugReport({
        title: title.trim(),
        description: description.trim(),
        category,
        accountName: account?.minecraftUsername,
        systemInfo: {
          ramMaxMb,
          launcherVersion,
          minecraftVersion: profile?.minecraftVersion,
          profileName: profile?.name,
          profileType: profile?.profileTypeId,
          graphicsMode: profile?.graphicsModeId,
          gpu: gpuInfo !== "Inconnu" ? gpuInfo : undefined,
          screenResolution:
            typeof window !== "undefined"
              ? `${window.screen.width}x${window.screen.height}`
              : undefined,
        },
        logs: logsToSend,
      });

      if (res.warning) {
        setSuccessMessage(res.warning);
      } else {
        setSuccessMessage("Signalement envoyé avec succès ! Merci de ton aide.");
      }

      setTimeout(() => {
        onClose();
        setTitle("");
        setDescription("");
        setSuccessMessage(null);
      }, 2200);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de l'envoi du signalement.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-divider bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-divider mb-4">
          <div className="flex items-center gap-2 text-ink">
            <Bug className="size-5 text-accent-400" />
            <h2 className="text-lg font-bold">Signaler un bug</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-400 hover:text-ink transition-colors p-1 rounded-md"
          >
            <X className="size-4" />
          </button>
        </div>

        {successMessage ? (
          <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
            <CheckCircle2 className="size-12 text-emerald-400 animate-in zoom-in-50 duration-200" />
            <p className="text-sm font-semibold text-ink">{successMessage}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-danger/10 border border-danger/30 p-2.5 text-xs text-danger">
                <AlertTriangle className="size-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Catégorie
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-divider bg-ground px-3 py-2 text-xs font-medium text-ink outline-none transition-colors hover:border-neutral-700 focus:border-accent"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Titre court
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Le jeu plante dès que j'appuie sur Jouer"
                className="w-full rounded-lg border border-divider bg-ground px-3 py-2 text-xs font-medium text-ink placeholder:text-neutral-500 outline-none transition-colors hover:border-neutral-700 focus:border-accent"
                maxLength={120}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
                Description détaillée
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Que s'est-il passé ? Comment reproduire le problème ?"
                rows={4}
                className="w-full resize-none rounded-lg border border-divider bg-ground p-3 text-xs font-medium text-ink placeholder:text-neutral-500 outline-none transition-colors hover:border-neutral-700 focus:border-accent"
                maxLength={2000}
                required
              />
            </div>

            <div className="rounded-xl border border-divider bg-ground/50 p-3 flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={attachLogs}
                  onChange={(e) => setAttachLogs(e.target.checked)}
                  className="rounded bg-surface border-divider text-accent size-3.5"
                />
                <span className="text-xs font-medium text-neutral-300">
                  Joindre les logs récents ({detectedLogs.length} lignes) et infos système
                </span>
              </label>
              <div className="text-[11px] text-neutral-500 flex flex-wrap gap-x-3 gap-y-1">
                <span>Joueur : {account?.minecraftUsername ?? "Anonyme"}</span>
                <span>Instance : {profile?.name ?? "Défaut"} ({profile?.minecraftVersion ?? "—"})</span>
                <span>RAM allouée : {ramMaxMb ? `${Math.round(ramMaxMb / 1024)} Go` : "Défaut"}</span>
                {gpuInfo !== "Inconnu" && <span>GPU : {gpuInfo}</span>}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-divider">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-neutral-400 hover:text-ink transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white font-semibold text-xs transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Send className="size-3.5" />
                )}
                <span>Envoyer le signalement</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

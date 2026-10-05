import { useState, useEffect, useMemo } from "react";
import {
  Download,
  Plus,
  Check,
  Loader2,
  Images,
  FileText,
  History,
  Info,
  ExternalLink,
  Code2,
  Globe,
  MessageSquare,
  Shield,
  Layers,
  Calendar,
  X,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { marked } from "marked";
import { invoke } from "@tauri-apps/api/core";
import {
  getProject,
  listProjectVersions,
  type ModProject,
  type ModSearchHit,
  type ModVersion,
} from "../../../shared/api/modsClient";
import { Modal } from "../Modal";

type Props = {
  hit: ModSearchHit | null;
  isOpen: boolean;
  onClose: () => void;
  onInstall: (hit: ModSearchHit) => void;
  isInstalling: boolean;
  isInstalled: boolean;
  gameVersion?: string | undefined;
  loader?: string | undefined;
};

type ActiveTab = "description" | "gallery" | "versions" | "info";

export function ModDetailsModal({
  hit,
  isOpen,
  onClose,
  onInstall,
  isInstalling,
  isInstalled,
  gameVersion,
  loader,
}: Props) {
  const { t } = useTranslation();
  const [project, setProject] = useState<ModProject | null>(null);
  const [versions, setVersions] = useState<ModVersion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("description");
  const [selectedImage, setSelectedImage] = useState<{ url: string; title?: string | undefined } | null>(null);

  const fetchDetails = () => {
    if (!hit) return;
    setLoading(true);
    setError(null);

    Promise.all([
      getProject(hit.projectId),
      listProjectVersions(hit.projectId, { gameVersion, loader }).catch(() => [] as ModVersion[]),
    ])
      .then(([projData, versionsData]) => {
        setProject(projData);
        setVersions(versionsData);
      })
      .catch((err) => {
        console.error("Failed to load mod details:", err);
        setError("Impossible de charger les informations complètes du mod.");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOpen && hit) {
      setActiveTab("description");
      setSelectedImage(null);
      fetchDetails();
    } else {
      setProject(null);
      setVersions([]);
      setError(null);
      setSelectedImage(null);
    }
  }, [isOpen, hit?.projectId]);

  const renderedMarkdown = useMemo(() => {
    const raw = project?.body?.trim() || project?.description?.trim() || hit?.description || "";
    if (!raw) return "";
    try {
      return marked.parse(raw, { async: false, gfm: true, breaks: true }) as string;
    } catch {
      return `<p>${raw}</p>`;
    }
  }, [project?.body, project?.description, hit?.description]);

  const handleOpenLink = (url: string | null | undefined) => {
    if (!url) return;
    invoke("open_external_url", { url }).catch(() => {
      window.open(url, "_blank", "noopener,noreferrer");
    });
  };

  if (!isOpen || !hit) return null;

  const gallery = project?.gallery || [];
  const categories = project?.categories || hit.categories || [];

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={hit.title} maxWidth="max-w-5xl">
        <div className="flex flex-col h-full max-h-[80vh] overflow-hidden">
          {/* Header Summary */}
          <div className="p-6 border-b border-divider bg-surface/50 shrink-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              {hit.iconUrl ? (
                <img
                  src={hit.iconUrl}
                  alt=""
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl shrink-0 object-cover bg-ground border border-divider shadow-md"
                />
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl bg-well border border-divider shrink-0 flex items-center justify-center">
                  <span className="text-3xl text-neutral-500 font-bold">?</span>
                </div>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h2 className="text-xl sm:text-2xl font-bold text-ink truncate">{hit.title}</h2>
                  {categories.slice(0, 3).map((cat) => (
                    <span
                      key={cat}
                      className="px-2 py-0.5 text-[11px] font-semibold bg-accent-900/60 border border-accent-700/50 text-accent-300 rounded-md capitalize"
                    >
                      {cat}
                    </span>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-neutral-400 mb-3">
                  <span>{t("mods.by")} <strong className="text-neutral-200">{hit.author}</strong></span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Download className="w-3.5 h-3.5 text-accent" />
                    {hit.downloads.toLocaleString()} téléchargements
                  </span>
                  {project?.license?.name && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Shield className="w-3.5 h-3.5 text-neutral-400" />
                        {project.license.name}
                      </span>
                    </>
                  )}
                </div>

                <p className="text-neutral-300 text-xs sm:text-sm line-clamp-2">
                  {project?.description || hit.description}
                </p>
              </div>

              {/* Action Button */}
              <div className="shrink-0 w-full sm:w-auto mt-2 sm:mt-0 flex sm:flex-col gap-2">
                <button
                  type="button"
                  onClick={() => onInstall(hit)}
                  disabled={isInstalling || isInstalled}
                  className="w-full sm:w-auto px-5 py-2.5 bg-accent text-accent-100 disabled:opacity-50 disabled:bg-well disabled:text-neutral-500 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110 shadow-sm"
                >
                  {isInstalling ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : isInstalled ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  <span>{isInstalled ? "Déjà installé" : "Installer dans le profil"}</span>
                </button>

                {project?.source_url && (
                  <button
                    type="button"
                    onClick={() => handleOpenLink(project.source_url)}
                    className="hidden sm:flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-divider hover:border-neutral-600 text-xs text-neutral-300 hover:text-ink transition-colors"
                  >
                    <Code2 className="w-3.5 h-3.5" />
                    <span>Code source</span>
                  </button>
                )}
              </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex items-center gap-2 mt-5 border-t border-divider pt-3">
              <button
                type="button"
                onClick={() => setActiveTab("description")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === "description"
                    ? "bg-accent/20 border border-accent text-accent-100"
                    : "text-neutral-400 hover:text-ink hover:bg-well border border-transparent"
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Description</span>
              </button>

              {gallery.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab("gallery")}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                    activeTab === "gallery"
                      ? "bg-accent/20 border border-accent text-accent-100"
                      : "text-neutral-400 hover:text-ink hover:bg-well border border-transparent"
                  }`}
                >
                  <Images className="w-4 h-4" />
                  <span>Galerie ({gallery.length})</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveTab("versions")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === "versions"
                    ? "bg-accent/20 border border-accent text-accent-100"
                    : "text-neutral-400 hover:text-ink hover:bg-well border border-transparent"
                }`}
              >
                <History className="w-4 h-4" />
                <span>Versions {versions.length > 0 ? `(${versions.length})` : ""}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("info")}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  activeTab === "info"
                    ? "bg-accent/20 border border-accent text-accent-100"
                    : "text-neutral-400 hover:text-ink hover:bg-well border border-transparent"
                }`}
              >
                <Info className="w-4 h-4" />
                <span>Liens & Détails</span>
              </button>
            </div>
          </div>

          {/* Tab Contents */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-neutral-400">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
                <p className="text-sm font-medium">Chargement des détails depuis Modrinth...</p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <p className="text-danger text-sm font-medium">{error}</p>
                <button
                  type="button"
                  onClick={fetchDetails}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-well hover:bg-neutral-800 text-neutral-200 text-xs font-semibold border border-divider transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Réessayer</span>
                </button>
              </div>
            ) : (
              <>
                {/* 1. DESCRIPTION TAB */}
                {activeTab === "description" && (
                  <div className="max-w-4xl mx-auto">
                    {renderedMarkdown ? (
                      <div
                        className="text-neutral-200 text-sm leading-relaxed space-y-4
                          [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-ink [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:pb-2 [&_h1]:border-b [&_h1]:border-divider
                          [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h2]:mt-5 [&_h2]:mb-2.5
                          [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-ink [&_h3]:mt-4 [&_h3]:mb-2
                          [&_p]:text-neutral-300 [&_p]:leading-relaxed [&_p]:mb-3
                          [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:text-neutral-300 [&_ul]:space-y-1
                          [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:text-neutral-300 [&_ol]:space-y-1
                          [&_li]:text-neutral-300
                          [&_code]:bg-well [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_code]:text-accent-300 [&_code]:font-mono [&_code]:text-xs
                          [&_pre]:bg-ground [&_pre]:border [&_pre]:border-divider [&_pre]:rounded-xl [&_pre]:p-4 [&_pre]:overflow-x-auto [&_pre]:my-4
                          [&_pre_code]:bg-transparent [&_pre_code]:p-0
                          [&_a]:text-accent [&_a]:underline hover:[&_a]:text-accent-300
                          [&_blockquote]:border-l-4 [&_blockquote]:border-accent/60 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-neutral-400 [&_blockquote]:my-4
                          [&_img]:rounded-xl [&_img]:max-w-full [&_img]:h-auto [&_img]:my-4 [&_img]:shadow-md [&_img]:border [&_img]:border-divider
                          [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_table]:text-xs
                          [&_th]:border [&_th]:border-divider [&_th]:bg-surface [&_th]:p-2.5 [&_th]:text-left [&_th]:font-semibold [&_th]:text-ink
                          [&_td]:border [&_td]:border-divider [&_td]:p-2.5 [&_td]:text-neutral-300"
                        dangerouslySetInnerHTML={{ __html: renderedMarkdown }}
                      />
                    ) : (
                      <p className="text-neutral-400 text-center py-10">Aucune description disponible pour ce mod.</p>
                    )}
                  </div>
                )}

                {/* 2. GALLERY TAB */}
                {activeTab === "gallery" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {gallery.map((img, i) => (
                      <div
                        key={i}
                        onClick={() => setSelectedImage({ url: img.url, title: img.title })}
                        className="group relative cursor-pointer overflow-hidden rounded-xl border border-divider bg-surface transition-all hover:border-accent hover:shadow-lg"
                      >
                        <img
                          src={img.url}
                          alt={img.title || "Capture d'écran du mod"}
                          className="w-full h-52 object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          loading="lazy"
                        />
                        <div className="p-3 bg-ground/90 border-t border-divider">
                          <h4 className="text-xs font-semibold text-ink truncate">
                            {img.title || `Capture #${i + 1}`}
                          </h4>
                          {img.description && (
                            <p className="text-[11px] text-neutral-400 truncate mt-0.5">
                              {img.description}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 3. VERSIONS TAB */}
                {activeTab === "versions" && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-xs text-neutral-400 pb-2 border-b border-divider">
                      <span>Fichiers récents compatibles avec Minecraft {gameVersion || "actuel"}</span>
                      <span>{versions.length} versions disponibles</span>
                    </div>

                    {versions.length === 0 ? (
                      <p className="text-neutral-400 text-center py-12 text-sm">
                        Aucune version répertoriée pour cette configuration de jeu.
                      </p>
                    ) : (
                      <div className="divide-y divide-divider/50 border border-divider rounded-xl overflow-hidden bg-surface/30">
                        {versions.map((ver) => (
                          <div
                            key={ver.versionId}
                            className="p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-well/50 transition-colors"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-ink text-sm truncate">{ver.name}</span>
                                <span className="px-1.5 py-0.5 text-[10px] bg-accent-900/50 border border-accent/40 text-accent-300 rounded font-mono">
                                  {ver.versionNumber}
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-neutral-400">
                                <span>{ver.gameVersions.join(", ")}</span>
                                <span>•</span>
                                <span className="capitalize">{ver.loaders.join(", ")}</span>
                                <span>•</span>
                                <span>{(ver.size / 1024 / 1024).toFixed(2)} Mo</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                              <button
                                type="button"
                                onClick={() => handleOpenLink(ver.downloadUrl)}
                                title="Télécharger le fichier .jar"
                                className="p-2 rounded-lg border border-divider hover:border-accent text-neutral-300 hover:text-ink transition-colors"
                              >
                                <Download className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 4. INFO & DETAILS TAB */}
                {activeTab === "info" && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {/* General Metadata */}
                    <div className="bg-surface border border-divider rounded-xl p-5 space-y-4">
                      <h3 className="text-base font-bold text-ink flex items-center gap-2 border-b border-divider pb-3">
                        <Info className="w-4 h-4 text-accent" />
                        Informations générales
                      </h3>

                      <div className="space-y-3 text-xs sm:text-sm">
                        <div className="flex justify-between py-1 border-b border-divider/40">
                          <span className="text-neutral-400">Auteur</span>
                          <span className="font-semibold text-ink">{hit.author}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-divider/40">
                          <span className="text-neutral-400">Identifiant Modrinth</span>
                          <span className="font-mono text-neutral-300">{project?.slug || hit.slug}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-divider/40">
                          <span className="text-neutral-400">Téléchargements</span>
                          <span className="font-semibold text-ink">{hit.downloads.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-divider/40">
                          <span className="text-neutral-400">Côté client</span>
                          <span className="capitalize text-neutral-200">{project?.client_side || "Supporté"}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-divider/40">
                          <span className="text-neutral-400">Côté serveur</span>
                          <span className="capitalize text-neutral-200">{project?.server_side || "Supporté"}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-neutral-400">Licence</span>
                          <span className="font-semibold text-accent-300">{project?.license?.name || "Non spécifiée"}</span>
                        </div>
                      </div>
                    </div>

                    {/* External Links */}
                    <div className="bg-surface border border-divider rounded-xl p-5 space-y-4">
                      <h3 className="text-base font-bold text-ink flex items-center gap-2 border-b border-divider pb-3">
                        <ExternalLink className="w-4 h-4 text-accent" />
                        Liens externes
                      </h3>

                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => handleOpenLink(`https://modrinth.com/mod/${project?.slug || hit.slug}`)}
                          className="w-full flex items-center justify-between p-3 rounded-lg border border-divider hover:border-accent hover:bg-well/50 text-neutral-200 transition-colors text-xs sm:text-sm font-medium"
                        >
                          <span className="flex items-center gap-2.5">
                            <Globe className="w-4 h-4 text-accent" />
                            Page officielle sur Modrinth
                          </span>
                          <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                        </button>

                        {project?.source_url && (
                          <button
                            type="button"
                            onClick={() => handleOpenLink(project.source_url)}
                            className="w-full flex items-center justify-between p-3 rounded-lg border border-divider hover:border-accent hover:bg-well/50 text-neutral-200 transition-colors text-xs sm:text-sm font-medium"
                          >
                            <span className="flex items-center gap-2.5">
                              <Code2 className="w-4 h-4 text-neutral-300" />
                              Dépôt du code source
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                          </button>
                        )}

                        {project?.issues_url && (
                          <button
                            type="button"
                            onClick={() => handleOpenLink(project.issues_url)}
                            className="w-full flex items-center justify-between p-3 rounded-lg border border-divider hover:border-accent hover:bg-well/50 text-neutral-200 transition-colors text-xs sm:text-sm font-medium"
                          >
                            <span className="flex items-center gap-2.5">
                              <Info className="w-4 h-4 text-amber-400" />
                              Signaler un bug (Issue Tracker)
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                          </button>
                        )}

                        {project?.discord_url && (
                          <button
                            type="button"
                            onClick={() => handleOpenLink(project.discord_url)}
                            className="w-full flex items-center justify-between p-3 rounded-lg border border-divider hover:border-accent hover:bg-well/50 text-neutral-200 transition-colors text-xs sm:text-sm font-medium"
                          >
                            <span className="flex items-center gap-2.5">
                              <MessageSquare className="w-4 h-4 text-[#5865F2]" />
                              Serveur Discord communautaire
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                          </button>
                        )}

                        {project?.wiki_url && (
                          <button
                            type="button"
                            onClick={() => handleOpenLink(project.wiki_url)}
                            className="w-full flex items-center justify-between p-3 rounded-lg border border-divider hover:border-accent hover:bg-well/50 text-neutral-200 transition-colors text-xs sm:text-sm font-medium"
                          >
                            <span className="flex items-center gap-2.5">
                              <Layers className="w-4 h-4 text-emerald-400" />
                              Documentation & Wiki
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-neutral-400" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </Modal>

      {/* Lightbox Modal for Gallery Images */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
          onClick={() => setSelectedImage(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh] flex flex-col items-center">
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white transition-colors"
              aria-label="Fermer la vue agrandie"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={selectedImage.url}
              alt={selectedImage.title || "Image agrandie"}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
            {selectedImage.title && (
              <p className="mt-3 text-sm text-neutral-200 font-medium text-center">
                {selectedImage.title}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

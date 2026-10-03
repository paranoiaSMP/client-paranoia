import { useState, useEffect } from "react";
import { X, Download, Plus, Check, Loader2, Images } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getProject, type ModProject, type ModSearchHit } from "../../../shared/api/modsClient";
import { Modal } from "../Modal";

type Props = {
  hit: ModSearchHit;
  isOpen: boolean;
  onClose: () => void;
  onInstall: (hit: ModSearchHit) => void;
  isInstalling: boolean;
  isInstalled: boolean;
};

export function ModDetailsModal({
  hit,
  isOpen,
  onClose,
  onInstall,
  isInstalling,
  isInstalled,
}: Props) {
  const { t } = useTranslation();
  const [project, setProject] = useState<ModProject | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getProject(hit.projectId)
        .then(setProject)
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setProject(null);
    }
  }, [isOpen, hit.projectId]);

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={hit.title}
    >
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
        <div className="flex flex-col md:flex-row gap-6">
          {hit.iconUrl ? (
            <img
              src={hit.iconUrl}
              alt=""
              className="w-24 h-24 md:w-32 md:h-32 rounded-2xl shrink-0 object-cover bg-divider"
            />
          ) : (
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-divider shrink-0 flex items-center justify-center">
              <span className="text-4xl text-neutral-600">?</span>
            </div>
          )}

          <div className="flex-1 flex flex-col justify-center min-w-0">
            <h2 className="text-2xl font-bold text-ink truncate">{hit.title}</h2>
            <div className="text-neutral-400 text-sm mb-4">
              {t("mods.by")} {hit.author}
            </div>
            
            <div className="flex items-center gap-4">
              <button
                onClick={() => onInstall(hit)}
                disabled={isInstalling || isInstalled}
                className="px-6 py-2.5 bg-accent text-accent-100 disabled:opacity-50 disabled:bg-neutral-800 disabled:text-neutral-500 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors hover:bg-accent-600"
              >
                {isInstalling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : isInstalled ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {isInstalled ? "Installé" : "Add to instance"}
              </button>

              <div className="flex items-center gap-1.5 text-neutral-300 text-sm font-semibold">
                <Download className="w-4 h-4" />
                {hit.downloads.toLocaleString()}
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center min-h-[200px]">
            <Loader2 className="w-8 h-8 animate-spin text-accent" />
          </div>
        ) : project ? (
          <div className="flex flex-col gap-8">
            {project.description && (
              <div>
                <p className="text-neutral-300 leading-relaxed text-sm">
                  {project.description}
                </p>
              </div>
            )}

            {project.gallery && project.gallery.length > 0 && (
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
                  <Images className="w-5 h-5" /> Galerie
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {project.gallery.map((img, i) => (
                    <a href={img.url} target="_blank" rel="noreferrer" key={i} className="block rounded-xl overflow-hidden border border-divider hover:border-accent transition-colors">
                      <img src={img.url} alt={img.title || ""} className="w-full h-48 object-cover" />
                      {img.title && (
                        <div className="p-2 bg-surface text-xs text-center text-neutral-300 truncate">
                          {img.title}
                        </div>
                      )}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-neutral-500">
            Impossible de charger les informations du mod.
          </div>
        )}
      </div>
    </Modal>
  );
}

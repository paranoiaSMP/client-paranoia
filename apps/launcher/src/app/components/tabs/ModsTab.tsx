import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Search,
  Download,
  Trash2,
  Package,
  Loader2,
  AlertTriangle,
  X,
  FolderOpen,
  Plus,
  Check,
  Sun,
  Palette,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { LauncherProfile } from "@paranoia/contracts";
import {
  installMod,
  listInstalledMods,
  listProjectVersions,
  removeMod,
  searchMods,
  toggleMod,
  type ContentType,
  type InstalledMod,
  type ModSearchHit,
} from "../../../shared/api/modsClient";

type ModsTabProps = {
  profiles: LauncherProfile[];
  selectedProfileId: string;
  setSelectedProfileId: (id: string) => void;
  setError: (err: string | null) => void;
};

function ErrorNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-danger/10 border border-danger/30 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
      <p className="text-sm text-danger flex-1 break-words">{message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-neutral-500 hover:text-ink transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

export function ModsTab({
  profiles,
  selectedProfileId,
  setSelectedProfileId,
  setError,
}: ModsTabProps) {
  const { t } = useTranslation();
  const [contentType, setContentType] = useState<ContentType>("mod");
  const [page, setPage] = useState(1);
  const [totalHits, setTotalHits] = useState(0);
  const profile =
    profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null;

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ModSearchHit[]>([]);
  const [installed, setInstalled] = useState<InstalledMod[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyProject, setBusyProject] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const report = useCallback(
    (message: string | null) => {
      setLocalError(message);
      setError(message);
    },
    [setError],
  );

  const refreshInstalled = useCallback(async () => {
    if (!profile) return;
    try {
      setInstalled(await listInstalledMods(profile.id, contentType));
    } catch (e) {
      report(e instanceof Error ? e.message : "Lecture du contenu impossible");
    }
  }, [profile, report, contentType]);

  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  function switchContentType(type: ContentType) {
    if (type === contentType) return;
    setContentType(type);
    setHits([]);
    setTotalHits(0);
    setQuery("");
    setPage(1);
    setNotice(null);
    report(null);
  }

  async function runSearch(targetPage = 1) {
    setPage(targetPage);
    if (!profile) return;
    setSearching(true);
    report(null);
    try {
      const result = await searchMods({
        query,
        gameVersion: profile.minecraftVersion,
        loader: contentType === "mod" ? "fabric" : undefined,
        projectType: contentType,
        limit: 20,
        offset: (targetPage - 1) * 20,
      });
      setHits(result.hits);
      setTotalHits(result.total);
    } catch (e) {
      report(e instanceof Error ? e.message : "Recherche Modrinth impossible");
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleInstall(hit: ModSearchHit) {
    if (!profile) return;
    setBusyProject(hit.projectId);
    report(null);
    setNotice(null);
    try {
      const versions = await listProjectVersions(hit.projectId, {
        gameVersion: profile.minecraftVersion,
        loader: contentType === "mod" ? "fabric" : undefined,
      });

      const version = versions[0];
      if (!version) {
        throw new Error(
          `${hit.title} n'a pas de version pour Minecraft ${profile.minecraftVersion}`,
        );
      }

      const result = await installMod({
        profileId: profile.id,
        projectId: hit.projectId,
        versionId: version.versionId,
        gameVersion: profile.minecraftVersion,
        loader: contentType === "mod" ? "fabric" : undefined,
        projectType: contentType,
      });
      await refreshInstalled();

      if (result.dependencies.length > 0) {
        setNotice(
          `${hit.title} installé avec ${result.dependencies.length} dépendance${result.dependencies.length > 1 ? "s" : ""} : ` +
            result.dependencies.map((d) => d.fileName).join(", "),
        );
      } else {
        setNotice(`${hit.title} installé.`);
      }
    } catch (e) {
      report(e instanceof Error ? e.message : "Installation impossible");
    } finally {
      setBusyProject(null);
    }
  }

  async function openFolder() {
    if (!profile) return;
    try {
      await invoke("open_instance_folder", { profileId: profile.id });
    } catch (e) {
      report(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRemove(fileName: string) {
    if (!profile) return;
    try {
      await removeMod(profile.id, fileName, contentType);
      await refreshInstalled();
    } catch (e) {
      report(e instanceof Error ? e.message : "Suppression impossible");
    }
  }

  async function handleToggle(fileName: string) {
    if (!profile) return;
    try {
      await toggleMod(profile.id, fileName, contentType);
      await refreshInstalled();
    } catch (e) {
      report(e instanceof Error ? e.message : "Impossible de modifier l'état");
    }
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package className="w-10 h-10 text-neutral-700 mb-3" />
        <p className="text-neutral-500">Crée un profil pour installer des mods.</p>
      </div>
    );
  }

  const FallbackIcon =
    contentType === "shader"
      ? Sun
      : contentType === "resourcepack"
      ? Palette
      : Package;

  const typeTitle =
    contentType === "shader"
      ? "Shaders"
      : contentType === "resourcepack"
      ? "Packs de textures"
      : "Mods";

  const searchPlaceholder =
    contentType === "shader"
      ? "Rechercher des shaders..."
      : contentType === "resourcepack"
      ? "Rechercher des packs de textures..."
      : t("mods.searchPlaceholder");

  return (
    <div className="w-full animate-in fade-in duration-400 flex flex-col pt-2 max-w-[1000px] mx-auto">
      <div className="flex items-center gap-1.5 mb-3 bg-surface p-1 rounded-xl border border-divider w-fit">
        <button
          type="button"
          onClick={() => switchContentType("mod")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
            contentType === "mod"
              ? "bg-accent text-white shadow-sm"
              : "text-neutral-400 hover:text-ink hover:bg-white/5"
          }`}
        >
          <Package className="w-4 h-4" />
          <span>Mods</span>
        </button>
        <button
          type="button"
          onClick={() => switchContentType("shader")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
            contentType === "shader"
              ? "bg-accent text-white shadow-sm"
              : "text-neutral-400 hover:text-ink hover:bg-white/5"
          }`}
        >
          <Sun className="w-4 h-4" />
          <span>Shaders</span>
        </button>
        <button
          type="button"
          onClick={() => switchContentType("resourcepack")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all ${
            contentType === "resourcepack"
              ? "bg-accent text-white shadow-sm"
              : "text-neutral-400 hover:text-ink hover:bg-white/5"
          }`}
        >
          <Palette className="w-4 h-4" />
          <span>Texture Packs</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-3 w-full mb-3">
        <div className="flex items-center bg-surface rounded-xl px-4 py-3 flex-1 border border-divider">
          <Search className="w-5 h-5 text-neutral-600 mr-3 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch(1)}
            placeholder={searchPlaceholder}
            className="bg-transparent border-none outline-none text-sm md:text-base font-medium w-full text-ink placeholder:text-neutral-600"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <select
          value={profile.id}
          onChange={(e) => setSelectedProfileId(e.target.value)}
          title={t("mods.selectProfile")}
          className="bg-surface border border-divider hover:border-neutral-700 text-neutral-300 rounded-lg px-3 py-2 text-xs md:text-sm font-semibold outline-none transition-colors shrink-0"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({p.minecraftVersion})
            </option>
          ))}
        </select>
        <button
          onClick={openFolder}
          title={t("mods.openFolder")}
          className="bg-surface border border-divider hover:border-neutral-700 text-neutral-300 hover:text-ink px-3 py-2 rounded-lg transition-colors flex items-center justify-center shrink-0"
        >
          <FolderOpen className="w-4 h-4" />
        </button>
      
        {totalHits > 0 && (
          <div className="flex items-center gap-2 text-neutral-300 text-sm font-bold shrink-0">
            <button 
              onClick={() => runSearch(Math.max(1, page - 1))}
              disabled={page === 1 || searching}
              className="w-8 h-8 flex items-center justify-center bg-surface border border-divider hover:border-neutral-700 hover:text-ink rounded-lg transition-colors disabled:opacity-50"
            >
              &lt;
            </button>
            <span className="px-2">{t("mods.page")} {page} / {Math.ceil(totalHits / 20)}</span>
            <button 
              onClick={() => runSearch(Math.min(Math.ceil(totalHits / 20), page + 1))}
              disabled={page >= Math.ceil(totalHits / 20) || searching}
              className="w-8 h-8 flex items-center justify-center bg-surface border border-divider hover:border-neutral-700 hover:text-ink rounded-lg transition-colors disabled:opacity-50"
            >
              &gt;
            </button>
          </div>
        )}
      </div>

      {localError && (
        <div className="mb-4">
          <ErrorNotice message={localError} onDismiss={() => report(null)} />
        </div>
      )}

      {notice && (
        <div className="mb-4 bg-accent/10 border border-accent/30 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
          <FallbackIcon className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-accent-300 flex-1 break-words">{notice}</p>
          <button
            onClick={() => setNotice(null)}
            className="shrink-0 text-neutral-500 hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {hits.length > 0 && (
        <div className="grid gap-3 mb-6">
          {hits.map((hit) => {
            const isInstalling = busyProject === hit.projectId;
            const isInstalled = installed.some(m => m.fileName.toLowerCase().includes(hit.slug.toLowerCase()) || m.fileName.toLowerCase().includes(hit.title.toLowerCase().replace(/ /g, '-')));
            return (
              <div
                key={hit.projectId}
                className="bg-ground border border-divider rounded-2xl p-4 md:p-5 flex flex-col md:flex-row gap-4 md:gap-5 hover:border-neutral-700 transition-colors group"
              >
                <div className="flex flex-1 gap-4 md:gap-5 min-w-0">
                  {hit.iconUrl ? (
                    <img
                      src={hit.iconUrl}
                      alt=""
                      className="w-20 h-20 md:w-24 md:h-24 rounded-xl shrink-0 object-cover bg-divider"
                    />
                  ) : (
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-divider shrink-0 flex items-center justify-center">
                      <FallbackIcon className="w-8 h-8 text-neutral-600" />
                    </div>
                  )}

                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-bold text-lg md:text-xl text-ink truncate">{hit.title}</h3>
                      <span className="text-neutral-500 text-sm truncate hidden sm:inline">{t("mods.by")} {hit.author}</span>
                    </div>
                    <p className="text-neutral-300 text-xs md:text-sm line-clamp-2 leading-relaxed">
                      {hit.description}
                    </p>
                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center md:items-end justify-between border-t md:border-t-0 md:border-l border-divider pt-4 md:pt-0 md:pl-5 shrink-0 gap-3 md:gap-4">
                  <button
                    onClick={() => handleInstall(hit)}
                    disabled={isInstalling || isInstalled}
                    className="w-full md:w-auto px-4 md:px-5 py-2 md:py-2.5 bg-transparent hover:bg-accent/10 border border-accent text-accent disabled:opacity-50 disabled:border-neutral-700 disabled:text-neutral-500 disabled:hover:bg-transparent rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-colors"
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

                  <div className="flex items-center justify-center md:justify-end gap-3 md:gap-4 text-neutral-300 text-xs md:text-sm font-semibold w-full md:w-auto">
                    <span className="flex items-center gap-1.5" title="Downloads">
                      <Download className="w-4 h-4" />
                      {formatDownloads(hit.downloads)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Installed list at the bottom */}
      <div className="mt-4 border-t border-divider pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-ink">
            {typeTitle} de ce profil{" "}
            <span className="text-neutral-500 font-normal">
              ({installed.length})
            </span>
          </h2>
          <p className="text-neutral-600 text-xs hidden sm:block">
            {contentType === "mod"
              ? `Installés dans ce profil uniquement, filtrés pour Fabric ${profile.minecraftVersion}.`
              : "Installés dans ce profil uniquement."}
          </p>
        </div>

        {installed.length === 0 ? (
          <div className="bg-surface border border-divider rounded-xl p-6 text-center">
            <p className="text-neutral-600 text-sm">
              {contentType === "shader"
                ? "Aucun shader installé sur ce profil."
                : contentType === "resourcepack"
                ? "Aucun pack de textures installé sur ce profil."
                : "Aucun mod installé sur ce profil."}
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {installed.map((mod) => (
              <div
                key={mod.fileName}
                className={`bg-surface border border-divider rounded-lg px-4 py-3 flex items-center gap-3 hover:border-neutral-700 transition-colors ${
                  !mod.enabled ? "opacity-60" : ""
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleToggle(mod.fileName)}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    mod.enabled ? "bg-accent" : "bg-neutral-700"
                  }`}
                  title={mod.enabled ? "Désactiver" : "Activer"}
                >
                  <span
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      mod.enabled ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
                {mod.iconUrl ? (
                  <img
                    src={mod.iconUrl}
                    alt={mod.name ?? mod.fileName}
                    className="w-8 h-8 rounded-lg object-cover shrink-0"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-divider flex items-center justify-center shrink-0">
                    <FallbackIcon className="w-4 h-4 text-neutral-600" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium truncate ${mod.enabled ? "text-ink" : "text-neutral-400 line-through"}`}>
                    {mod.name ?? mod.fileName}
                  </div>
                  {mod.name && mod.name !== mod.fileName && (
                    <div className="text-xs text-neutral-600 truncate font-mono">
                      {mod.fileName}
                    </div>
                  )}
                </div>
                <span className="text-neutral-600 text-xs shrink-0 font-mono">
                  {(mod.size / 1024 / 1024).toFixed(1)} Mo
                </span>
                <button
                  onClick={() => handleRemove(mod.fileName)}
                  className="shrink-0 p-2 bg-divider hover:bg-danger/20 text-neutral-500 hover:text-danger rounded-lg transition-colors"
                  title={t("mods.remove")}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Search, Download, Trash2, Package, Loader2, AlertTriangle, X, FolderOpen, Heart, Plus, Check, ChevronDown, ChevronRight } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { LauncherProfile } from "@paranoia/contracts";
import {
  installMod,
  listInstalledMods,
  listProjectVersions,
  removeMod,
  searchMods,
  type InstalledMod,
  type ModSearchHit,
} from "../../../shared/api/modsClient";

type ModsTabProps = {
  profiles: LauncherProfile[];
  selectedProfileId: string;
  setSelectedProfileId: (id: string) => void;
  setError: (err: string | null) => void;
};

/**
 * Les erreurs remontees a l'application n'etaient affichees que sur l'ecran
 * d'echec au demarrage: une recherche ou une installation qui echouait ne
 * produisait donc aucun message. On les montre ici, dans l'onglet concerne.
 */
function ErrorNotice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="bg-accent-red/10 border border-accent-red/30 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
      <AlertTriangle className="w-4 h-4 text-accent-red shrink-0 mt-0.5" />
      <p className="text-sm text-[#fca5a5] flex-1 break-words">{message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 text-[#7a7194] hover:text-white transition-colors"
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
      setInstalled(await listInstalledMods(profile.id));
    } catch (e) {
      report(e instanceof Error ? e.message : "Lecture des mods impossible");
    }
  }, [profile, report]);

  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  async function runSearch(targetPage = 1) {
    setPage(targetPage);
    // setSearching(true); (handled below)
    if (!profile) return;
    setSearching(true);
    report(null);
    try {
      const result = await searchMods({
        query,
        gameVersion: profile.minecraftVersion,
        loader: "fabric",
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
      // On prend la version la plus recente compatible avec ce profil.
      const versions = await listProjectVersions(hit.projectId, {
        gameVersion: profile.minecraftVersion,
        loader: "fabric",
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
        loader: "fabric",
      });
      await refreshInstalled();

      // Fabric API et consorts arrivent avec le mod: on le dit, sinon leur
      // apparition dans la liste ressemble a un bug.
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
      await removeMod(profile.id, fileName);
      await refreshInstalled();
    } catch (e) {
      report(e instanceof Error ? e.message : "Suppression impossible");
    }
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package className="w-10 h-10 text-[#372d58] mb-3" />
        <p className="text-[#7a7194]">Crée un profil pour installer des mods.</p>
      </div>
    );
  }

  return (
    <div className="w-full animate-in fade-in duration-400 flex flex-col pt-2 max-w-[1000px] mx-auto">
      


      {/* Search Bar */}
      <div className="flex items-center gap-3 w-full mb-3">
        <div className="flex items-center bg-[#1a1529] rounded-xl px-4 py-3 flex-1 border border-[#241d3c]">
          <Search className="w-5 h-5 text-[#463a70] mr-3 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch(1)}
            placeholder={t("mods.searchPlaceholder")}
            className="bg-transparent border-none outline-none text-sm md:text-base font-medium w-full text-white placeholder:text-[#463a70]"
          />
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-end gap-2 mb-4">
        <select
          value={profile.id}
          onChange={(e) => setSelectedProfileId(e.target.value)}
          title={t("mods.selectProfile")}
          className="bg-[#1a1529] border border-[#241d3c] hover:border-[#372d58] text-[#9a92b6] rounded-lg px-3 py-2 text-xs md:text-sm font-semibold outline-none transition-colors shrink-0"
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
          className="bg-[#1a1529] border border-[#241d3c] hover:border-[#372d58] text-[#9a92b6] hover:text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center shrink-0"
        >
          <FolderOpen className="w-4 h-4" />
        </button>
      
        {totalHits > 0 && (
          <div className="flex items-center gap-2 text-[#9a92b6] text-sm font-bold shrink-0">
            <button 
              onClick={() => runSearch(Math.max(1, page - 1))}
              disabled={page === 1 || searching}
              className="w-8 h-8 flex items-center justify-center bg-[#1a1529] border border-[#241d3c] hover:border-[#372d58] hover:text-white rounded-lg transition-colors disabled:opacity-50"
            >
              &lt;
            </button>
            <span className="px-2">{t("mods.page")} {page} / {Math.ceil(totalHits / 20)}</span>
            <button 
              onClick={() => runSearch(Math.min(Math.ceil(totalHits / 20), page + 1))}
              disabled={page >= Math.ceil(totalHits / 20) || searching}
              className="w-8 h-8 flex items-center justify-center bg-[#1a1529] border border-[#241d3c] hover:border-[#372d58] hover:text-white rounded-lg transition-colors disabled:opacity-50"
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
        <div className="mb-4 bg-accent-purple/10 border border-accent-purple/30 rounded-lg px-3 py-2.5 flex items-start gap-2.5">
          <Package className="w-4 h-4 text-accent-purple shrink-0 mt-0.5" />
          <p className="text-sm text-[#d8b4fe] flex-1 break-words">{notice}</p>
          <button
            onClick={() => setNotice(null)}
            className="shrink-0 text-[#7a7194] hover:text-white transition-colors"
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
                className="bg-[#121214] border border-[#241d3c] rounded-2xl p-4 md:p-5 flex flex-col md:flex-row gap-4 md:gap-5 hover:border-[#372d58] transition-colors group"
              >
                <div className="flex flex-1 gap-4 md:gap-5 min-w-0">
                  {hit.iconUrl ? (
                    <img
                      src={hit.iconUrl}
                      alt=""
                      className="w-20 h-20 md:w-24 md:h-24 rounded-xl shrink-0 object-cover bg-[#241d3c]"
                    />
                  ) : (
                    <div className="w-20 h-20 md:w-24 md:h-24 rounded-xl bg-[#241d3c] shrink-0 flex items-center justify-center">
                      <Package className="w-8 h-8 text-[#463a70]" />
                    </div>
                  )}

                  <div className="flex-1 flex flex-col min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h3 className="font-bold text-lg md:text-xl text-white truncate">{hit.title}</h3>
                      <span className="text-[#7a7194] text-sm truncate hidden sm:inline">{t("mods.by")} {hit.author}</span>
                    </div>
                    <p className="text-[#9a92b6] text-xs md:text-sm line-clamp-2 leading-relaxed">
                      {hit.description}
                    </p>
                    

                  </div>
                </div>

                <div className="flex flex-row md:flex-col items-center md:items-end justify-between border-t md:border-t-0 md:border-l border-[#241d3c] pt-4 md:pt-0 md:pl-5 shrink-0 gap-3 md:gap-4">
                  <button
                    onClick={() => handleInstall(hit)}
                    disabled={isInstalling || isInstalled}
                    className="w-full md:w-auto px-4 md:px-5 py-2 md:py-2.5 bg-transparent hover:bg-accent-purple/10 border border-accent-purple text-accent-purple disabled:opacity-50 disabled:border-[#372d58] disabled:text-[#7a7194] disabled:hover:bg-transparent rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-colors"
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

                  <div className="flex items-center justify-center md:justify-end gap-3 md:gap-4 text-[#9a92b6] text-xs md:text-sm font-semibold w-full md:w-auto">
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

      {/* Installed Mods list at the bottom */}
      <div className="mt-4 border-t border-[#241d3c] pt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white">
            Mods de ce profil{" "}
            <span className="text-[#7a7194] font-normal">
              ({installed.length})
            </span>
          </h2>
          <p className="text-[#463a70] text-xs hidden sm:block">
            InstallÃ©s dans ce profil uniquement, filtrÃ©s pour Fabric {profile.minecraftVersion}.
          </p>
        </div>

        {installed.length === 0 ? (
          <div className="bg-[#1a1529] border border-[#241d3c] rounded-xl p-6 text-center">
            <p className="text-[#463a70] text-sm">
              Aucun mod installÃ© sur ce profil.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {installed.map((mod) => (
              <div
                key={mod.fileName}
                className="bg-[#1a1529] border border-[#241d3c] rounded-lg px-4 py-3 flex items-center gap-4 hover:border-[#372d58] transition-colors"
              >
                <Package className="w-5 h-5 text-[#463a70] shrink-0" />
                <span className="text-sm truncate flex-1 font-medium">{mod.fileName}</span>
                <span className="text-[#463a70] text-xs shrink-0 font-mono">
                  {(mod.size / 1024 / 1024).toFixed(1)} Mo
                </span>
                <button
                  onClick={() => handleRemove(mod.fileName)}
                  className="shrink-0 p-2 bg-[#241d3c] hover:bg-accent-red/20 text-[#7a7194] hover:text-accent-red rounded-lg transition-colors"
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

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Info,
  Eye,
  Boxes,
  ArrowUpDown,
  RefreshCw,
  FolderInput,
  Compass,
  Layers,
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
import { ModDetailsModal } from "./ModDetailsModal";

type ModsTabProps = {
  profiles: LauncherProfile[];
  selectedProfileId: string;
  setSelectedProfileId: (id: string) => void;
  setError: (err: string | null) => void;
};

type InstalledItemWithMeta = InstalledMod & {
  type: ContentType;
};

type ViewMode = "installed" | "browse";
type CategoryFilter = "all" | ContentType;
type SortOption = "name-asc" | "name-desc" | "status" | "size-desc" | "size-asc";

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`;
  return String(count);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }
  if (bytes >= 1024) {
    return `${(bytes / 1024).toFixed(0)} Ko`;
  }
  return `${bytes} o`;
}

function getCategoryLabel(type: ContentType): string {
  switch (type) {
    case "mod":
      return "Mod";
    case "shader":
      return "Shader";
    case "resourcepack":
      return "Pack de textures";
    case "datapack":
      return "Datapack";
  }
}

function getCategoryIcon(type: ContentType) {
  switch (type) {
    case "shader":
      return Sun;
    case "resourcepack":
      return Palette;
    case "datapack":
      return Boxes;
    case "mod":
    default:
      return Package;
  }
}

export function ModsTab({
  profiles,
  selectedProfileId,
  setSelectedProfileId,
  setError,
}: ModsTabProps) {
  const { t } = useTranslation();
  const profile =
    profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null;

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("installed");

  // Installed view state
  const [installedCategory, setInstalledCategory] = useState<CategoryFilter>("all");
  const [installedQuery, setInstalledQuery] = useState("");
  const [installedSort, setInstalledSort] = useState<SortOption>("name-asc");
  const [installedItems, setInstalledItems] = useState<InstalledItemWithMeta[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(false);

  // Browse view state
  const [browseCategory, setBrowseCategory] = useState<ContentType>("mod");
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseHits, setBrowseHits] = useState<ModSearchHit[]>([]);
  const [browseTotalHits, setBrowseTotalHits] = useState(0);
  const [browsePage, setBrowsePage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);

  // Operation states
  const [busyProject, setBusyProject] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Details modal state
  const [selectedHitForDetails, setSelectedHitForDetails] = useState<ModSearchHit | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailsCategory, setDetailsCategory] = useState<ContentType>("mod");

  const report = useCallback(
    (message: string | null) => {
      setLocalError(message);
      setError(message);
    },
    [setError],
  );

  // Refresh installed content
  const refreshInstalled = useCallback(async () => {
    if (!profile) return;
    setLoadingInstalled(true);
    try {
      const [mods, shaders, packs, datapacks] = await Promise.all([
        listInstalledMods(profile.id, "mod").catch(() => [] as InstalledMod[]),
        listInstalledMods(profile.id, "shader").catch(() => [] as InstalledMod[]),
        listInstalledMods(profile.id, "resourcepack").catch(() => [] as InstalledMod[]),
        listInstalledMods(profile.id, "datapack").catch(() => [] as InstalledMod[]),
      ]);

      const combined: InstalledItemWithMeta[] = [
        ...mods.map((m) => ({ ...m, type: "mod" as ContentType })),
        ...shaders.map((s) => ({ ...s, type: "shader" as ContentType })),
        ...packs.map((p) => ({ ...p, type: "resourcepack" as ContentType })),
        ...datapacks.map((d) => ({ ...d, type: "datapack" as ContentType })),
      ];

      setInstalledItems(combined);
    } catch (e) {
      report(e instanceof Error ? e.message : "Lecture du contenu installé impossible");
    } finally {
      setLoadingInstalled(false);
    }
  }, [profile, report]);

  useEffect(() => {
    void refreshInstalled();
  }, [refreshInstalled]);

  // Browse search
  const runBrowseSearch = useCallback(
    async (targetPage = 1, category = browseCategory, queryOverride?: string) => {
      if (!profile) return;
      setBrowsePage(targetPage);
      setIsSearching(true);
      const q = queryOverride !== undefined ? queryOverride : browseQuery;
      try {
        const result = await searchMods({
          query: q,
          gameVersion: profile.minecraftVersion,
          loader: category === "mod" ? "fabric" : undefined,
          projectType: category,
          limit: 20,
          offset: (targetPage - 1) * 20,
        });
        setBrowseHits(result.hits);
        setBrowseTotalHits(result.total);
      } catch (e) {
        report(e instanceof Error ? e.message : "Recherche Modrinth impossible");
        setBrowseHits([]);
      } finally {
        setIsSearching(false);
      }
    },
    [profile, browseCategory, browseQuery, report],
  );

  function handleSwitchBrowseCategory(cat: ContentType) {
    if (cat === browseCategory) return;
    setBrowseCategory(cat);
    setBrowsePage(1);
    void runBrowseSearch(1, cat, browseQuery);
  }

  // Live search debounced: triggers automatically when typing in browse mode
  useEffect(() => {
    if (viewMode !== "browse" || !profile) return;

    const timer = setTimeout(() => {
      void runBrowseSearch(1, browseCategory, browseQuery);
    }, 280);

    return () => clearTimeout(timer);
  }, [browseQuery, browseCategory, viewMode, profile?.id, runBrowseSearch]);

  async function handleInstall(hit: ModSearchHit, targetCategory: ContentType = browseCategory) {
    if (!profile) return;
    setBusyProject(hit.projectId);
    setLocalError(null);
    setNotice(null);
    try {
      // 1. Chercher d'abord les versions compatibles avec la version de Minecraft et le loader
      let versions = await listProjectVersions(hit.projectId, {
        gameVersion: profile.minecraftVersion,
        loader: targetCategory === "mod" ? "fabric" : undefined,
      });

      // 2. Si aucune version exacte, essayer avec le loader uniquement (pour les mods Fabric)
      if (versions.length === 0 && targetCategory === "mod") {
        versions = await listProjectVersions(hit.projectId, {
          loader: "fabric",
        });
      }

      // 3. Si toujours vide (ex: datapacks, shaders, texture packs), prendre la version la plus récente
      if (versions.length === 0) {
        versions = await listProjectVersions(hit.projectId, {});
      }

      const version = versions[0];
      if (!version) {
        throw new Error(
          `Aucune version téléchargeable trouvée pour « ${hit.title} ».`,
        );
      }

      const result = await installMod({
        profileId: profile.id,
        projectId: hit.projectId,
        versionId: version.versionId,
        gameVersion: profile.minecraftVersion,
        loader: targetCategory === "mod" ? "fabric" : undefined,
        projectType: targetCategory,
      });

      await refreshInstalled();

      if (result.dependencies.length > 0) {
        setNotice(
          `${hit.title} installé avec succès (${result.dependencies.length} dépendance${
            result.dependencies.length > 1 ? "s" : ""
          } : ${result.dependencies.map((d) => d.name || d.fileName).join(", ")})`,
        );
      } else {
        setNotice(`${hit.title} a été installé avec succès.`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Installation impossible";
      setLocalError(msg);
      setError(msg);
    } finally {
      setBusyProject(null);
    }
  }

  async function handleToggle(item: InstalledItemWithMeta) {
    if (!profile) return;
    try {
      await toggleMod(profile.id, item.fileName, item.type);
      await refreshInstalled();
    } catch (e) {
      report(e instanceof Error ? e.message : "Impossible de modifier l'état du fichier");
    }
  }

  async function handleRemove(item: InstalledItemWithMeta) {
    if (!profile) return;
    try {
      await removeMod(profile.id, item.fileName, item.type);
      await refreshInstalled();
      setNotice(`${item.name || item.fileName} a été supprimé.`);
    } catch (e) {
      report(e instanceof Error ? e.message : "Suppression impossible");
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

  function handleOpenDetails(hit: ModSearchHit, cat: ContentType = browseCategory) {
    setSelectedHitForDetails(hit);
    setDetailsCategory(cat);
    setIsDetailsOpen(true);
  }

  async function handleOpenInstalledDetails(item: InstalledItemWithMeta) {
    const matchedHit = browseHits.find(
      (h) =>
        item.fileName.toLowerCase().includes(h.slug.toLowerCase()) ||
        item.fileName.toLowerCase().includes(h.title.toLowerCase().replace(/ /g, "-")),
    );
    if (matchedHit) {
      handleOpenDetails(matchedHit, item.type);
      return;
    }

    const cleanName = (item.name || item.fileName)
      .replace(/\.(jar|zip)$/i, "")
      .replace(/[-_]/g, " ")
      .trim();

    try {
      setIsSearching(true);
      const res = await searchMods({
        query: cleanName,
        gameVersion: profile?.minecraftVersion,
        loader: item.type === "mod" ? "fabric" : undefined,
        projectType: item.type,
        limit: 1,
      });
      const firstHit = res.hits[0];
      if (firstHit) {
        handleOpenDetails(firstHit, item.type);
      } else {
        setNotice(
          `Aucune fiche détaillée trouvée sur Modrinth pour "${item.name || item.fileName}".`,
        );
      }
    } catch (e) {
      report(e instanceof Error ? e.message : "Recherche des détails impossible");
    } finally {
      setIsSearching(false);
    }
  }

  // Category counts
  const counts = useMemo(() => {
    const res = {
      all: installedItems.length,
      mod: 0,
      shader: 0,
      resourcepack: 0,
      datapack: 0,
    };
    for (const item of installedItems) {
      if (item.type in res) {
        res[item.type as ContentType]++;
      }
    }
    return res;
  }, [installedItems]);

  // Filtered and sorted installed list
  const filteredInstalled = useMemo(() => {
    let list = installedItems;
    if (installedCategory !== "all") {
      list = list.filter((item) => item.type === installedCategory);
    }
    if (installedQuery.trim()) {
      const q = installedQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          (item.name && item.name.toLowerCase().includes(q)) ||
          item.fileName.toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => {
      const nameA = (a.name || a.fileName).toLowerCase();
      const nameB = (b.name || b.fileName).toLowerCase();
      switch (installedSort) {
        case "name-asc":
          return nameA.localeCompare(nameB);
        case "name-desc":
          return nameB.localeCompare(nameA);
        case "status":
          if (a.enabled === b.enabled) return nameA.localeCompare(nameB);
          return a.enabled ? -1 : 1;
        case "size-desc":
          return b.size - a.size;
        case "size-asc":
          return a.size - b.size;
        default:
          return 0;
      }
    });
  }, [installedItems, installedCategory, installedQuery, installedSort]);

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package className="w-10 h-10 text-neutral-500 mb-3" />
        <p className="text-neutral-300">Créez un profil pour gérer votre contenu.</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col pt-1 max-w-[1040px] mx-auto pb-10">
      {/* Instance Summary Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface border border-divider mb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-well border border-divider flex items-center justify-center shrink-0 text-accent">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-ink leading-tight">
                {profile.name}
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-well border border-divider text-accent font-mono font-medium">
                Fabric {profile.minecraftVersion}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-neutral-400 mt-1">
              <span>{installedItems.length} élément{installedItems.length > 1 ? "s" : ""} installé{installedItems.length > 1 ? "s" : ""}</span>
              {profiles.length > 1 && (
                <>
                  <span className="text-neutral-600">•</span>
                  <select
                    value={profile.id}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="bg-transparent text-xs text-neutral-300 hover:text-ink cursor-pointer outline-none underline underline-offset-2"
                  >
                    {profiles.map((p) => (
                      <option key={p.id} value={p.id} className="bg-surface text-ink">
                        Changer pour {p.name}
                      </option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Quick action buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => void refreshInstalled()}
            disabled={loadingInstalled}
            title="Rafraîchir la liste depuis le disque"
            className="flex items-center gap-1.5 px-3 py-2 bg-well hover:bg-neutral-800 border border-divider text-neutral-300 hover:text-ink rounded-lg text-xs font-medium transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loadingInstalled ? "animate-spin text-accent" : ""}`}
            />
            <span>Rafraîchir</span>
          </button>

          <button
            type="button"
            onClick={openFolder}
            title="Ouvrir le dossier de cette instance"
            className="flex items-center gap-1.5 px-3 py-2 bg-well hover:bg-neutral-800 border border-divider text-neutral-300 hover:text-ink rounded-lg text-xs font-medium transition-colors"
          >
            <FolderOpen className="w-3.5 h-3.5 text-accent" />
            <span>Ouvrir le dossier</span>
          </button>
        </div>
      </div>

      {/* Main Dual-Mode Tab Navigation */}
      <div className="flex items-center border-b border-divider gap-6 mb-6">
        <button
          type="button"
          onClick={() => setViewMode("installed")}
          className={`pb-3.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            viewMode === "installed"
              ? "border-accent text-ink"
              : "border-transparent text-neutral-400 hover:text-ink"
          }`}
        >
          <Layers className="w-4 h-4 text-accent" />
          <span>Contenu installé</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-well text-neutral-300 font-mono">
            {installedItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode("browse")}
          className={`pb-3.5 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            viewMode === "browse"
              ? "border-accent text-ink"
              : "border-transparent text-neutral-400 hover:text-ink"
          }`}
        >
          <Compass className="w-4 h-4 text-accent" />
          <span>Découvrir & Installer</span>
        </button>
      </div>

      {/* Alerts */}
      {localError && (
        <div className="mb-4 bg-danger/10 border border-danger/30 rounded-xl px-4 py-3 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
          <p className="text-sm text-danger flex-1 break-words">{localError}</p>
          <button
            onClick={() => report(null)}
            className="shrink-0 text-neutral-400 hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {notice && (
        <div className="mb-4 bg-accent/10 border border-accent/30 rounded-xl px-4 py-3 flex items-start gap-3">
          <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
          <p className="text-sm text-accent-300 flex-1 break-words">{notice}</p>
          <button
            onClick={() => setNotice(null)}
            className="shrink-0 text-neutral-400 hover:text-ink transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ============================================================ */}
      {/* VUE 1 : CONTENU INSTALLÉ                                     */}
      {/* ============================================================ */}
      {viewMode === "installed" && (
        <div className="flex flex-col gap-4">
          {/* Category Pills & Add Shortcut */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-surface border border-divider">
              <button
                type="button"
                onClick={() => setInstalledCategory("all")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  installedCategory === "all"
                    ? "bg-accent text-white"
                    : "text-neutral-400 hover:text-ink hover:bg-well"
                }`}
              >
                <span>Tous</span>
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full font-mono ${
                    installedCategory === "all"
                      ? "bg-white/20 text-white"
                      : "bg-well text-neutral-300"
                  }`}
                >
                  {counts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setInstalledCategory("mod")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  installedCategory === "mod"
                    ? "bg-accent text-white"
                    : "text-neutral-400 hover:text-ink hover:bg-well"
                }`}
              >
                <Package className="w-3.5 h-3.5" />
                <span>Mods</span>
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full font-mono ${
                    installedCategory === "mod"
                      ? "bg-white/20 text-white"
                      : "bg-well text-neutral-300"
                  }`}
                >
                  {counts.mod}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setInstalledCategory("shader")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  installedCategory === "shader"
                    ? "bg-accent text-white"
                    : "text-neutral-400 hover:text-ink hover:bg-well"
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Shaders</span>
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full font-mono ${
                    installedCategory === "shader"
                      ? "bg-white/20 text-white"
                      : "bg-well text-neutral-300"
                  }`}
                >
                  {counts.shader}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setInstalledCategory("resourcepack")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  installedCategory === "resourcepack"
                    ? "bg-accent text-white"
                    : "text-neutral-400 hover:text-ink hover:bg-well"
                }`}
              >
                <Palette className="w-3.5 h-3.5" />
                <span>Packs de textures</span>
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full font-mono ${
                    installedCategory === "resourcepack"
                      ? "bg-white/20 text-white"
                      : "bg-well text-neutral-300"
                  }`}
                >
                  {counts.resourcepack}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setInstalledCategory("datapack")}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  installedCategory === "datapack"
                    ? "bg-accent text-white"
                    : "text-neutral-400 hover:text-ink hover:bg-well"
                }`}
              >
                <Boxes className="w-3.5 h-3.5" />
                <span>Datapacks</span>
                <span
                  className={`text-xs px-1.5 py-0.2 rounded-full font-mono ${
                    installedCategory === "datapack"
                      ? "bg-white/20 text-white"
                      : "bg-well text-neutral-300"
                  }`}
                >
                  {counts.datapack}
                </span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setViewMode("browse");
                if (installedCategory !== "all") {
                  setBrowseCategory(installedCategory);
                  void runBrowseSearch(1, installedCategory);
                }
              }}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-accent/15 hover:bg-accent/25 border border-accent/40 text-accent text-xs font-semibold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Installer du contenu</span>
            </button>
          </div>

          {/* Search bar & Sorting */}
          {installedItems.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-divider">
              <div className="flex items-center bg-well rounded-lg px-3.5 py-2 flex-1 border border-divider">
                <Search className="w-4 h-4 text-neutral-400 mr-2.5 shrink-0" />
                <input
                  type="text"
                  value={installedQuery}
                  onChange={(e) => setInstalledQuery(e.target.value)}
                  placeholder="Rechercher parmi les fichiers installés..."
                  className="bg-transparent border-none outline-none text-xs sm:text-sm font-medium w-full text-ink placeholder:text-neutral-500"
                />
                {installedQuery && (
                  <button
                    type="button"
                    onClick={() => setInstalledQuery("")}
                    className="text-neutral-400 hover:text-ink p-0.5 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-xs text-neutral-400 flex items-center gap-1.5">
                  <ArrowUpDown className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Trier par :</span>
                </span>
                <select
                  value={installedSort}
                  onChange={(e) => setInstalledSort(e.target.value as SortOption)}
                  className="bg-well border border-divider text-neutral-200 rounded-lg px-3 py-2 text-xs font-medium outline-none hover:border-neutral-700 transition-colors cursor-pointer"
                >
                  <option value="name-asc" className="bg-surface text-ink">
                    Nom (A → Z)
                  </option>
                  <option value="name-desc" className="bg-surface text-ink">
                    Nom (Z → A)
                  </option>
                  <option value="status" className="bg-surface text-ink">
                    Statut (Actifs d'abord)
                  </option>
                  <option value="size-desc" className="bg-surface text-ink">
                    Taille (Plus lourds)
                  </option>
                  <option value="size-asc" className="bg-surface text-ink">
                    Taille (Plus légers)
                  </option>
                </select>
              </div>
            </div>
          )}

          {/* Empty state: 0 items in profile */}
          {installedItems.length === 0 ? (
            <div className="rounded-2xl border border-divider bg-surface p-12 text-center flex flex-col items-center justify-center my-4">
              <div className="w-16 h-16 rounded-2xl bg-well border border-divider flex items-center justify-center mb-5 text-accent">
                <Boxes className="w-8 h-8" />
              </div>

              <h3 className="text-lg font-bold text-ink mb-2">
                Aucun contenu installé
              </h3>

              <p className="text-sm text-neutral-400 max-w-md mx-auto mb-6 leading-relaxed">
                Ce profil ne possède encore aucun mod, shader, pack de textures ou datapack.
                Parcourez le catalogue pour enrichir votre jeu.
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={openFolder}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-well hover:bg-neutral-800 border border-divider text-neutral-300 hover:text-ink text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
                >
                  <FolderInput className="w-4 h-4 text-neutral-400" />
                  <span>Importer des fichiers</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode("browse")}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm cursor-pointer"
                >
                  <Compass className="w-4 h-4" />
                  <span>Parcourir le catalogue</span>
                </button>
              </div>
            </div>
          ) : filteredInstalled.length === 0 ? (
            /* Empty state for search filter */
            <div className="rounded-xl border border-divider bg-surface p-8 text-center flex flex-col items-center justify-center">
              <p className="text-sm text-neutral-300 mb-2">
                Aucun élément ne correspond à votre recherche ou à ce filtre.
              </p>
              <button
                type="button"
                onClick={() => {
                  setInstalledQuery("");
                  setInstalledCategory("all");
                }}
                className="text-xs text-accent hover:underline cursor-pointer"
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            /* Installed Items List */
            <div className="flex flex-col gap-2">
              {filteredInstalled.map((item) => {
                const ItemIcon = getCategoryIcon(item.type);
                return (
                  <div
                    key={`${item.type}-${item.fileName}`}
                    className={`bg-surface border border-divider rounded-xl px-4 py-3 flex items-center gap-3.5 hover:border-neutral-700 transition-colors ${
                      !item.enabled ? "opacity-60" : ""
                    }`}
                  >
                    {/* Toggle button */}
                    <button
                      type="button"
                      onClick={() => void handleToggle(item)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        item.enabled ? "bg-accent" : "bg-neutral-700"
                      }`}
                      title={item.enabled ? "Désactiver" : "Activer"}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          item.enabled ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>

                    {/* Icon or Fallback */}
                    {item.iconUrl ? (
                      <img
                        src={item.iconUrl}
                        alt=""
                        className="w-9 h-9 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-80"
                        onClick={() => void handleOpenInstalledDetails(item)}
                        loading="lazy"
                      />
                    ) : (
                      <div
                        className="w-9 h-9 rounded-lg bg-well border border-divider flex items-center justify-center shrink-0 cursor-pointer hover:bg-neutral-800"
                        onClick={() => void handleOpenInstalledDetails(item)}
                        title="Détails"
                      >
                        <ItemIcon className="w-4 h-4 text-neutral-400" />
                      </div>
                    )}

                    {/* Content Names */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => void handleOpenInstalledDetails(item)}
                      title="Afficher les détails"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-semibold truncate ${
                            item.enabled
                              ? "text-ink hover:text-accent"
                              : "text-neutral-400 line-through"
                          } transition-colors`}
                        >
                          {item.name ?? item.fileName}
                        </span>

                        <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded bg-well border border-divider text-neutral-300 shrink-0">
                          {getCategoryLabel(item.type)}
                        </span>
                      </div>

                      {item.name && item.name !== item.fileName && (
                        <div className="text-xs text-neutral-400 truncate font-mono mt-0.5">
                          {item.fileName}
                        </div>
                      )}
                    </div>

                    {/* File Size */}
                    <span className="text-neutral-400 text-xs shrink-0 font-mono">
                      {formatBytes(item.size)}
                    </span>

                    {/* Info Button */}
                    <button
                      type="button"
                      onClick={() => void handleOpenInstalledDetails(item)}
                      className="shrink-0 p-2 bg-well hover:bg-neutral-800 text-neutral-400 hover:text-accent rounded-lg border border-divider transition-colors cursor-pointer"
                      title="Voir les détails"
                    >
                      <Info className="w-4 h-4" />
                    </button>

                    {/* Delete Button */}
                    <button
                      type="button"
                      onClick={() => void handleRemove(item)}
                      className="shrink-0 p-2 bg-well hover:bg-danger/15 text-neutral-400 hover:text-danger rounded-lg border border-divider transition-colors cursor-pointer"
                      title="Supprimer ce contenu"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* VUE 2 : DÉCOUVRIR & INSTALLER (MODRINTH)                      */}
      {/* ============================================================ */}
      {viewMode === "browse" && (
        <div className="flex flex-col gap-4">
          {/* Category Selector Tabs */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface border border-divider w-fit">
            <button
              type="button"
              onClick={() => handleSwitchBrowseCategory("mod")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
                browseCategory === "mod"
                  ? "bg-accent text-white shadow-sm"
                  : "text-neutral-400 hover:text-ink hover:bg-well"
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Mods</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchBrowseCategory("shader")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
                browseCategory === "shader"
                  ? "bg-accent text-white shadow-sm"
                  : "text-neutral-400 hover:text-ink hover:bg-well"
              }`}
            >
              <Sun className="w-4 h-4" />
              <span>Shaders</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchBrowseCategory("resourcepack")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
                browseCategory === "resourcepack"
                  ? "bg-accent text-white shadow-sm"
                  : "text-neutral-400 hover:text-ink hover:bg-well"
              }`}
            >
              <Palette className="w-4 h-4" />
              <span>Packs de textures</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitchBrowseCategory("datapack")}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs md:text-sm font-semibold transition-all cursor-pointer ${
                browseCategory === "datapack"
                  ? "bg-accent text-white shadow-sm"
                  : "text-neutral-400 hover:text-ink hover:bg-well"
              }`}
            >
              <Boxes className="w-4 h-4" />
              <span>Datapacks</span>
            </button>
          </div>

          {/* Search Bar & Pagination */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="flex items-center bg-surface rounded-xl px-4 py-3 flex-1 border border-divider">
              {isSearching ? (
                <Loader2 className="w-5 h-5 text-accent mr-3 shrink-0 animate-spin" />
              ) : (
                <Search className="w-5 h-5 text-neutral-400 mr-3 shrink-0" />
              )}
              <input
                type="text"
                value={browseQuery}
                onChange={(e) => setBrowseQuery(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && void runBrowseSearch(1, browseCategory, browseQuery)
                }
                placeholder={
                  browseCategory === "shader"
                    ? "Rechercher des shaders sur Modrinth..."
                    : browseCategory === "resourcepack"
                    ? "Rechercher des packs de textures sur Modrinth..."
                    : browseCategory === "datapack"
                    ? "Rechercher des datapacks sur Modrinth..."
                    : "Rechercher des mods Fabric sur Modrinth..."
                }
                className="bg-transparent border-none outline-none text-sm font-medium w-full text-ink placeholder:text-neutral-500"
              />
              {browseQuery && (
                <button
                  type="button"
                  onClick={() => setBrowseQuery("")}
                  className="text-neutral-400 hover:text-ink p-1 mr-2 cursor-pointer"
                  title="Effacer la recherche"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => void runBrowseSearch(1, browseCategory, browseQuery)}
                disabled={isSearching}
                className="px-4 py-1.5 rounded-lg bg-well hover:bg-neutral-800 border border-divider text-xs font-semibold text-ink transition-colors shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Rechercher"}
              </button>
            </div>

            {/* Pagination Controls */}
            {browseTotalHits > 0 && (
              <div className="flex items-center justify-between sm:justify-end gap-2 text-neutral-300 text-xs sm:text-sm font-semibold shrink-0">
                <button
                  type="button"
                  onClick={() => void runBrowseSearch(Math.max(1, browsePage - 1))}
                  disabled={browsePage === 1 || isSearching}
                  className="w-9 h-9 flex items-center justify-center bg-surface border border-divider hover:border-neutral-700 hover:text-ink rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  &lt;
                </button>
                <span className="px-2">
                  Page {browsePage} / {Math.max(1, Math.ceil(browseTotalHits / 20))}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    void runBrowseSearch(
                      Math.min(Math.ceil(browseTotalHits / 20), browsePage + 1),
                    )
                  }
                  disabled={browsePage >= Math.ceil(browseTotalHits / 20) || isSearching}
                  className="w-9 h-9 flex items-center justify-center bg-surface border border-divider hover:border-neutral-700 hover:text-ink rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  &gt;
                </button>
              </div>
            )}
          </div>

          {/* Search Loading */}
          {isSearching && browseHits.length === 0 && (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
              <p className="text-sm text-neutral-300">Recherche sur le catalogue Modrinth...</p>
            </div>
          )}

          {/* Hits List */}
          {browseHits.length > 0 && (
            <div className="grid gap-3">
              {browseHits.map((hit) => {
                const isInstalling = busyProject === hit.projectId;
                const isInstalled = installedItems.some(
                  (m) =>
                    (m.projectId && m.projectId === hit.projectId) ||
                    (m.name && m.name.toLowerCase() === hit.title.toLowerCase()) ||
                    m.fileName.toLowerCase().includes(hit.slug.toLowerCase()) ||
                    m.fileName.toLowerCase().includes(hit.title.toLowerCase().replace(/ /g, "-")),
                );
                const FallbackIcon = getCategoryIcon(browseCategory);

                return (
                  <div
                    key={hit.projectId}
                    className="bg-surface border border-divider rounded-2xl p-4 md:p-5 flex flex-col md:flex-row gap-4 md:gap-5 hover:border-neutral-700 transition-colors group"
                  >
                    {/* Thumbnail & Info */}
                    <div
                      onClick={() => handleOpenDetails(hit, browseCategory)}
                      className="flex flex-1 gap-4 md:gap-5 min-w-0 cursor-pointer"
                      title="Afficher la fiche complète"
                    >
                      {hit.iconUrl ? (
                        <img
                          src={hit.iconUrl}
                          alt=""
                          className="w-20 h-20 md:w-22 md:h-22 rounded-xl shrink-0 object-cover bg-well border border-divider group-hover:brightness-105 transition-all"
                        />
                      ) : (
                        <div className="w-20 h-20 md:w-22 md:h-22 rounded-xl bg-well border border-divider shrink-0 flex items-center justify-center">
                          <FallbackIcon className="w-8 h-8 text-neutral-500" />
                        </div>
                      )}

                      <div className="flex-1 flex flex-col min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <h3 className="font-bold text-base md:text-lg text-ink truncate group-hover:text-accent transition-colors">
                            {hit.title}
                          </h3>
                          <span className="text-neutral-400 text-xs truncate">
                            {t("mods.by", "par")} {hit.author}
                          </span>
                        </div>

                        <p className="text-neutral-300 text-xs md:text-sm line-clamp-2 leading-relaxed">
                          {hit.description}
                        </p>

                        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                          {hit.categories.slice(0, 3).map((cat) => (
                            <span
                              key={cat}
                              className="text-[10px] font-semibold px-2 py-0.5 rounded bg-well border border-divider text-neutral-300 capitalize"
                            >
                              {cat}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Actions & Stats */}
                    <div className="flex flex-row md:flex-col items-center md:items-end justify-between border-t md:border-t-0 md:border-l border-divider pt-3 md:pt-0 md:pl-5 shrink-0 gap-3 md:gap-4">
                      <div className="flex items-center gap-2 w-full md:w-auto">
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(hit, browseCategory)}
                          className="px-3 py-2 bg-well hover:bg-neutral-800 border border-divider hover:border-neutral-600 text-neutral-300 hover:text-ink rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                          title="Fiche détaillée"
                        >
                          <Eye className="w-3.5 h-3.5 text-accent" />
                          <span>Détails</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleInstall(hit, browseCategory)}
                          disabled={isInstalling || isInstalled}
                          className={`flex-1 md:flex-initial px-4 py-2 rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                            isInstalled
                              ? "bg-well border border-divider text-neutral-400 cursor-default"
                              : "bg-transparent hover:bg-accent/10 border border-accent text-accent disabled:opacity-50"
                          }`}
                        >
                          {isInstalling ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : isInstalled ? (
                            <Check className="w-4 h-4 text-accent" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                          <span>{isInstalled ? "Installé" : "Installer"}</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-end gap-1.5 text-neutral-300 text-xs font-semibold">
                        <Download className="w-3.5 h-3.5 text-accent" />
                        <span>{formatDownloads(hit.downloads)} téléchargements</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty Search Results */}
          {!isSearching && browseHits.length === 0 && (
            <div className="rounded-xl border border-divider bg-surface p-12 text-center flex flex-col items-center justify-center">
              <p className="text-sm text-neutral-300 mb-2">
                Aucun projet trouvé pour cette recherche sur Modrinth.
              </p>
              <p className="text-xs text-neutral-400">
                Vérifiez l'orthographe ou essayez un mot-clé plus général.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Mod Details Modal */}
      {selectedHitForDetails && (
        <ModDetailsModal
          hit={selectedHitForDetails}
          isOpen={isDetailsOpen}
          onClose={() => {
            setIsDetailsOpen(false);
            setSelectedHitForDetails(null);
          }}
          onInstall={(h) => void handleInstall(h, detailsCategory)}
          isInstalling={busyProject === selectedHitForDetails.projectId}
          isInstalled={installedItems.some(
            (m) =>
              (m.projectId && m.projectId === selectedHitForDetails.projectId) ||
              (m.name && m.name.toLowerCase() === selectedHitForDetails.title.toLowerCase()) ||
              m.fileName.toLowerCase().includes(selectedHitForDetails.slug.toLowerCase()) ||
              m.fileName.toLowerCase().includes(
                selectedHitForDetails.title.toLowerCase().replace(/ /g, "-"),
              ),
          )}
          gameVersion={profile?.minecraftVersion}
          loader={detailsCategory === "mod" ? "fabric" : undefined}
        />
      )}
    </div>
  );
}

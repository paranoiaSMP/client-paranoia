import { useCallback, useEffect, useState } from "react";
import { Search, Download, Trash2, Package, Loader2 } from "lucide-react";
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

function formatDownloads(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${Math.round(count / 1_000)}k`;
  return String(count);
}

export function ModsTab({
  profiles,
  selectedProfileId,
  setSelectedProfileId,
  setError,
}: ModsTabProps) {
  const profile =
    profiles.find((p) => p.id === selectedProfileId) ?? profiles[0] ?? null;

  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ModSearchHit[]>([]);
  const [installed, setInstalled] = useState<InstalledMod[]>([]);
  const [searching, setSearching] = useState(false);
  const [busyProject, setBusyProject] = useState<string | null>(null);

  const refreshInstalled = useCallback(async () => {
    if (!profile) return;
    try {
      setInstalled(await listInstalledMods(profile.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lecture des mods impossible");
    }
  }, [profile, setError]);

  useEffect(() => {
    refreshInstalled();
  }, [refreshInstalled]);

  async function runSearch() {
    if (!profile) return;
    setSearching(true);
    setError(null);
    try {
      const result = await searchMods({
        query,
        gameVersion: profile.minecraftVersion,
        loader: "fabric",
        limit: 20,
      });
      setHits(result.hits);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recherche Modrinth impossible");
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleInstall(hit: ModSearchHit) {
    if (!profile) return;
    setBusyProject(hit.projectId);
    setError(null);
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

      await installMod({
        profileId: profile.id,
        projectId: hit.projectId,
        versionId: version.versionId,
      });
      await refreshInstalled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Installation impossible");
    } finally {
      setBusyProject(null);
    }
  }

  async function handleRemove(fileName: string) {
    if (!profile) return;
    try {
      await removeMod(profile.id, fileName);
      await refreshInstalled();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible");
    }
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Package className="w-10 h-10 text-[#3f3f46] mb-3" />
        <p className="text-[#71717a]">Crée un profil pour installer des mods.</p>
      </div>
    );
  }

  return (
    <div className="w-full animate-in fade-in duration-400 flex flex-col gap-5 text-white pt-2">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={profile.id}
          onChange={(e) => setSelectedProfileId(e.target.value)}
          className="bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2.5 text-sm outline-none"
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.minecraftVersion}
            </option>
          ))}
        </select>

        <div className="flex items-center bg-[#18181b] rounded-lg px-3 py-2.5 flex-1 min-w-[200px] border border-[#27272a]">
          <Search className="w-4 h-4 text-[#52525b] mr-2 shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Chercher un mod sur Modrinth..."
            className="bg-transparent border-none outline-none text-sm w-full text-white placeholder:text-[#52525b]"
          />
        </div>

        <button
          onClick={runSearch}
          disabled={searching}
          className="px-4 py-2.5 bg-accent-purple hover:bg-accent-purple-dark disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {searching ? "Recherche..." : "Rechercher"}
        </button>
      </div>

      <p className="text-[#52525b] text-xs -mt-2">
        Les mods sont installés dans ce profil uniquement, filtrés pour Fabric et
        Minecraft {profile.minecraftVersion}.
      </p>

      {hits.length > 0 && (
        <div className="grid gap-2">
          {hits.map((hit) => {
            const isInstalling = busyProject === hit.projectId;
            return (
              <div
                key={hit.projectId}
                className="bg-[#18181b] border border-[#27272a] rounded-xl p-3 flex items-center gap-3 hover:border-[#3f3f46] transition-colors"
              >
                {hit.iconUrl ? (
                  <img
                    src={hit.iconUrl}
                    alt=""
                    className="w-10 h-10 rounded-lg shrink-0 bg-[#27272a]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[#27272a] shrink-0 flex items-center justify-center">
                    <Package className="w-5 h-5 text-[#52525b]" />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{hit.title}</p>
                  <p className="text-[#71717a] text-xs truncate">
                    {hit.description}
                  </p>
                  <p className="text-[#52525b] text-[11px] mt-0.5">
                    {hit.author} · {formatDownloads(hit.downloads)}{" "}
                    téléchargements
                  </p>
                </div>

                <button
                  onClick={() => handleInstall(hit)}
                  disabled={isInstalling}
                  className="shrink-0 px-3 py-2 bg-[#27272a] hover:bg-accent-purple-dark disabled:opacity-50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  {isInstalling ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5" />
                  )}
                  Installer
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold mb-2">
          Mods de ce profil{" "}
          <span className="text-[#71717a] font-normal">
            ({installed.length})
          </span>
        </h2>

        {installed.length === 0 ? (
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 text-center">
            <p className="text-[#52525b] text-sm">
              Aucun mod installé sur ce profil.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {installed.map((mod) => (
              <div
                key={mod.fileName}
                className="bg-[#18181b] border border-[#27272a] rounded-lg px-3 py-2.5 flex items-center gap-3"
              >
                <Package className="w-4 h-4 text-[#52525b] shrink-0" />
                <span className="text-sm truncate flex-1">{mod.fileName}</span>
                <span className="text-[#52525b] text-xs shrink-0">
                  {(mod.size / 1024 / 1024).toFixed(1)} Mo
                </span>
                <button
                  onClick={() => handleRemove(mod.fileName)}
                  className="shrink-0 p-1.5 text-[#71717a] hover:text-accent-red transition-colors"
                  title="Retirer"
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

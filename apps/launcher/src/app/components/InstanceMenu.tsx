import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FolderOpen,
  Package,
  Play,
  Settings,
  Star,
  Trash2,
} from "lucide-react";
import type { LauncherProfile, RemoteConfiguration } from "@paranoia/contracts";
import { updateProfile } from "../../shared/api/profilesClient";

type InstanceMenuProps = {
  profile: LauncherProfile;
  modCount: number | null;
  running: boolean;
  onPlay: () => void;
  onOpenMods: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onRefresh?: () => Promise<unknown> | void;
  config?: RemoteConfiguration | null;
};

export function InstanceMenu({
  profile,
  modCount,
  running,
  onPlay,
  onOpenMods,
  onFavorite,
  onDelete,
  onRefresh,
  config,
}: InstanceMenuProps) {
  const [folderError, setFolderError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [minecraftVersion, setMinecraftVersion] = useState(profile.minecraftVersion);
  const [ramMb, setRamMb] = useState(profile.ramMb || 4096);
  const [resolution, setResolution] = useState(profile.resolution || "1920x1080");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const availableVersions = Array.from(
    new Set([
      profile.minecraftVersion,
      ...(config?.supportedMinecraftVersions ?? []),
    ]),
  );

  useEffect(() => {
    setName(profile.name);
    setMinecraftVersion(profile.minecraftVersion);
    setRamMb(profile.ramMb || 4096);
    setResolution(profile.resolution || "1920x1080");
  }, [profile]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    try {
      await updateProfile(profile.id, {
        name: name.trim() || profile.name,
        minecraftVersion,
        ramMb,
        resolution: resolution.trim() || profile.resolution,
      });
      await onRefresh?.();
      setEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  async function openFolder() {
    setFolderError(null);
    try {
      await invoke("open_instance_folder", { profileId: profile.id });
    } catch (e) {
      setFolderError(
        typeof e === "string" ? e : "Dossier introuvable. Lance l'instance une fois.",
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
          Caractéristiques
        </h3>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent-400 transition-colors"
        >
          <Settings className="h-3.5 w-3.5" />
          {editing ? "Fermer" : "Modifier"}
        </button>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4 rounded-xl border border-divider bg-ground p-4">
          <div>
            <label className="text-xs font-semibold text-neutral-400 block mb-1">
              Nom de l'instance
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-divider bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
              required
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-400 block mb-1">
              Version de Minecraft
            </label>
            <select
              value={minecraftVersion}
              onChange={(e) => setMinecraftVersion(e.target.value)}
              className="w-full rounded-lg border border-divider bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent cursor-pointer"
            >
              {availableVersions.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-semibold text-neutral-400">
                Mémoire allouée (RAM)
              </label>
              <span className="text-xs font-mono font-semibold text-accent">
                {Math.round(ramMb / 1024)} Go ({ramMb} Mo)
              </span>
            </div>
            <input
              type="range"
              min={1024}
              max={16384}
              step={1024}
              value={ramMb}
              onChange={(e) => setRamMb(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-600 font-mono mt-0.5">
              <span>1 Go</span>
              <span>4 Go</span>
              <span>8 Go</span>
              <span>16 Go</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-neutral-400 block mb-1">
              Résolution
            </label>
            <input
              type="text"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="1920x1080"
              className="w-full rounded-lg border border-divider bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-accent"
            />
          </div>

          {saveError && <p className="text-xs text-red-400">{saveError}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-ink hover:bg-accent-600 disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            <button
              type="button"
              onClick={() => {
                setName(profile.name);
                setMinecraftVersion(profile.minecraftVersion);
                setRamMb(profile.ramMb);
                setResolution(profile.resolution);
                setEditing(false);
              }}
              className="rounded-lg border border-divider bg-surface px-4 py-2.5 text-sm font-semibold text-neutral-400 hover:text-ink"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Detail label="Minecraft" value={profile.minecraftVersion} />
          <Detail label="Type" value={profile.profileTypeId} />
          <Detail label="Graphismes" value={profile.graphicsModeId} />
          <Detail label="Mémoire" value={`${Math.round(profile.ramMb / 1024)} Go`} />
          <Detail label="Résolution" value={profile.resolution} />
          <Detail
            label="Mods installés"
            value={modCount === null ? "--" : String(modCount)}
          />
        </div>
      )}

      {/* Actions principales */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onPlay}
          disabled={running}
          className="flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-3 text-sm font-semibold text-ink transition-colors hover:bg-accent-600 disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          <Play className="h-4 w-4 fill-current" />
          {running ? "En cours..." : "Jouer"}
        </button>

        <button
          onClick={onOpenMods}
          className="flex items-center justify-center gap-2 rounded-lg border border-divider bg-surface px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-accent"
          type="button"
        >
          <Package className="h-4 w-4" />
          Ajouter des mods
        </button>
      </div>

      {/* Dossier de l'instance */}
      <div>
        <button
          onClick={openFolder}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-divider bg-surface px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-accent"
          type="button"
        >
          <FolderOpen className="h-4 w-4" />
          Ouvrir le dossier de l'instance
        </button>
        <p className="mt-2 text-[11px] text-neutral-600">
          Contient les sauvegardes, les captures, les mods et options.txt.
        </p>
        {folderError && (
          <p className="mt-1 text-[11px] text-red-400">{folderError}</p>
        )}
      </div>

      {/* Actions secondaires */}
      <div className="flex items-center gap-3 border-t border-divider pt-4">
        <button
          onClick={onFavorite}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
            profile.favorite
              ? "text-amber-400 hover:bg-amber-400/10"
              : "text-neutral-300 hover:bg-divider hover:text-ink"
          }`}
          type="button"
        >
          <Star className={`h-4 w-4 ${profile.favorite ? "fill-current" : ""}`} />
          {profile.favorite ? "Favori" : "Mettre en favori"}
        </button>

        <button
          onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
          className="ml-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-400 transition-colors hover:bg-red-900/30"
          type="button"
        >
          <Trash2 className="h-4 w-4" />
          {confirmDelete ? "Confirmer la suppression" : "Supprimer"}
        </button>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-divider bg-ground px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-neutral-600">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold capitalize text-ink">
        {value}
      </p>
    </div>
  );
}

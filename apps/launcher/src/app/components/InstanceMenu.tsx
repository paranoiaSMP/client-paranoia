import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  FolderOpen,
  Package,
  Play,
  Star,
  Trash2,
} from "lucide-react";
import type { LauncherProfile } from "@paranoia/contracts";

type InstanceMenuProps = {
  profile: LauncherProfile;
  modCount: number | null;
  running: boolean;
  onPlay: () => void;
  onOpenMods: () => void;
  onFavorite: () => void;
  onDelete: () => void;
};

/**
 * Menu d'une instance, ouvert en cliquant sur sa vignette.
 *
 * <p>Rassemble ce qui concerne une instance et une seule: ses caracteristiques,
 * ses mods, son dossier. Les deux actions que le joueur cherche le plus --
 * installer un mod et ouvrir le dossier -- existaient deja, mais enfouies dans
 * l'onglet des mods, donc introuvables depuis l'accueil.
 */
export function InstanceMenu({
  profile,
  modCount,
  running,
  onPlay,
  onOpenMods,
  onFavorite,
  onDelete,
}: InstanceMenuProps) {
  const [folderError, setFolderError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function openFolder() {
    setFolderError(null);
    try {
      await invoke("open_instance_folder", { profileId: profile.id });
    } catch (e) {
      // Le dossier n'existe qu'apres un premier lancement: le dire vaut mieux
      // qu'un bouton qui ne fait rien.
      setFolderError(
        typeof e === "string" ? e : "Dossier introuvable. Lance l'instance une fois.",
      );
    }
  }

  return (
    <div className="space-y-5">
      {/* Caracteristiques */}
      <div className="grid grid-cols-2 gap-3">
        <Detail label="Minecraft" value={profile.minecraftVersion} />
        <Detail label="Type" value={profile.profileTypeId} />
        <Detail label="Graphismes" value={profile.graphicsModeId} />
        <Detail label="Memoire" value={`${Math.round(profile.ramMb / 1024)} Go`} />
        <Detail label="Resolution" value={profile.resolution} />
        <Detail
          label="Mods installes"
          value={modCount === null ? "--" : String(modCount)}
        />
      </div>

      {/* Actions principales */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onPlay}
          disabled={running}
          className="flex items-center justify-center gap-2 rounded-lg bg-accent-purple px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-purple-dark disabled:cursor-not-allowed disabled:opacity-50"
          type="button"
        >
          <Play className="h-4 w-4 fill-current" />
          {running ? "En cours..." : "Jouer"}
        </button>

        <button
          onClick={onOpenMods}
          className="flex items-center justify-center gap-2 rounded-lg border border-[#27272a] bg-[#18181b] px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-accent-purple"
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
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[#27272a] bg-[#18181b] px-4 py-3 text-sm font-semibold text-white transition-colors hover:border-accent-purple"
          type="button"
        >
          <FolderOpen className="h-4 w-4" />
          Ouvrir le dossier de l'instance
        </button>
        <p className="mt-2 text-[11px] text-[#52525b]">
          Contient les sauvegardes, les captures, les mods et options.txt.
        </p>
        {folderError && (
          <p className="mt-1 text-[11px] text-red-400">{folderError}</p>
        )}
      </div>

      {/* Actions secondaires */}
      <div className="flex items-center gap-3 border-t border-[#27272a] pt-4">
        <button
          onClick={onFavorite}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
            profile.favorite
              ? "text-amber-400 hover:bg-amber-400/10"
              : "text-[#a1a1aa] hover:bg-[#27272a] hover:text-white"
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
    <div className="rounded-lg border border-[#27272a] bg-[#131316] px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-[#52525b]">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold capitalize text-white">
        {value}
      </p>
    </div>
  );
}

import { useState } from "react";
import type { LauncherProfile } from "@paranoia/contracts";
import {
  deleteProfile,
  favoriteProfile,
  listProfiles,
} from "../../shared/api/profilesClient";

export function useProfiles(setError: (err: string | null) => void) {
  const [profiles, setProfiles] = useState<LauncherProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");

  /*
   * ACTUALISATION DES PROFILS
   * Met a jour la liste des profils locaux via l'API et definit le profil par defaut si necessaire.
   */
  async function refreshProfiles() {
    try {
      const refreshed = await listProfiles();
      setProfiles(refreshed);
      if (refreshed.length > 0 && !selectedProfileId) {
        setSelectedProfileId(refreshed[0]?.id || "");
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Erreur lors du chargement des profils",
      );
    }
  }

  /*
   * ACTIONS SUR LES PROFILS
   * Methodes pour supprimer ou mettre en favori un profil, puis actualiser la liste.
   */
  async function handleDeleteProfile(profileId: string) {
    try {
      await deleteProfile(profileId);
      await refreshProfiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de suppression");
    }
  }

  async function handleFavoriteProfile(profileId: string) {
    try {
      await favoriteProfile(profileId);
      await refreshProfiles();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur de mise en favori");
    }
  }

  return {
    profiles,
    setProfiles,
    selectedProfileId,
    setSelectedProfileId,
    refreshProfiles,
    handleDeleteProfile,
    handleFavoriteProfile,
  };
}

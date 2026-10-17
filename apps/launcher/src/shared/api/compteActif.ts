import { apiRequest } from "./http";

/**
 * Le compte choisi, des deux cotes a la fois.
 *
 * <p>Il vivait dans le `localStorage` de l'interface, ou personne d'autre ne
 * peut le lire. Le mod en jeu veut l'afficher, et il n'a pas acces au
 * navigateur embarque du launcher: le choix est donc enregistre par le
 * service local, dans un fichier, ou il appartient au client entier.
 *
 * <p>Le `localStorage` reste ecrit quand meme, et lu en premier au demarrage.
 * Ce n'est pas une redondance inutile: il repond immediatement, la ou le
 * service demande un aller-retour, et il repond encore si le service n'a pas
 * fini de demarrer. Le fichier tranche ensuite.
 */
const CLE = "paranoia_active_account_id";

function local(): string | null {
  try {
    return localStorage.getItem(CLE);
  } catch {
    // Navigateur sans stockage: le service fera foi a lui seul.
    return null;
  }
}

/**
 * Le compte choisi: celui du service, et a defaut celui du navigateur.
 *
 * <p>Le service d'abord, parce que c'est lui qui a la version partagee avec
 * le jeu. Le navigateur ensuite, pour le premier demarrage apres la mise a
 * jour -- le fichier n'existe pas encore, et le choix du joueur ne doit pas
 * se perdre a cette occasion.
 */
export async function compteActif(): Promise<string | null> {
  try {
    const { id } = await apiRequest<{ id: string | null }>(
      "/v1/auth/accounts/active",
    );
    return id ?? local();
  } catch {
    return local();
  }
}

/**
 * Enregistre le choix, des deux cotes.
 *
 * <p>L'envoi au service ne bloque pas et ne remonte pas ses echecs: changer
 * de compte doit etre instantane dans l'interface, et le pire qui puisse
 * arriver est que le jeu affiche le compte precedent jusqu'au prochain choix.
 */
export function choisitCompteActif(id: string | null): void {
  try {
    if (id === null) {
      localStorage.removeItem(CLE);
    } else {
      localStorage.setItem(CLE, id);
    }
  } catch {
    // Sans stockage local, le service suffit.
  }

  if (id === null) {
    return;
  }

  void apiRequest<void>(`/v1/auth/accounts/${encodeURIComponent(id)}/active`, {
    method: "PUT",
  }).catch(() => {});
}

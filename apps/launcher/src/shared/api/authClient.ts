import {
  MicrosoftAuthUrlResponse,
  MicrosoftAuthCallbackRequest,
  MicrosoftAccount,
} from "@paranoia/contracts";
import { apiRequest, ErreurApi, waitForApi } from "./http";

export async function getMicrosoftAuthorizeUrl(
  redirectUri: string,
): Promise<MicrosoftAuthUrlResponse> {
  const query = new URLSearchParams({ redirectUri });
  return apiRequest<MicrosoftAuthUrlResponse>(
    `/v1/auth/microsoft/url?${query.toString()}`,
  );
}

export async function completeMicrosoftCallback(
  req: MicrosoftAuthCallbackRequest,
): Promise<MicrosoftAccount> {
  return apiRequest<MicrosoftAccount>("/v1/auth/microsoft/callback", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

/** Comptes deja connectes lors des sessions precedentes. */
export async function listSavedAccounts(): Promise<MicrosoftAccount[]> {
  return apiRequest<MicrosoftAccount[]>("/v1/auth/accounts");
}

/**
 * Les comptes enregistres, apres avoir laisse au service local le temps
 * d'ecouter.
 *
 * <p>C'est la forme a utiliser au demarrage du launcher, et son absence etait
 * le defaut: le backend est un processus voisin demarre par Tauri en meme temps
 * que la fenetre, et il met environ une seconde a ecouter. La liste des
 * comptes, elle, etait demandee des le premier rendu -- donc avant. L'appel
 * partait en erreur reseau a chaque demarrage, et le launcher en concluait
 * qu'aucun compte n'etait enregistre: le joueur retrouvait l'ecran de connexion
 * a chaque lancement, et sur Windows la fenetre Microsoft s'ouvrait d'elle-meme
 * par-dessus.
 *
 * <p>Le reste du demarrage attendait deja le service de cette facon; seule
 * l'authentification ne le faisait pas.
 *
 * @throws si le service ne repond pas, ou si la liste reste illisible. Un echec
 *     doit se distinguer d'une liste vide: le premier ne dit rien des comptes
 *     du joueur, le second dit qu'il n'en a aucun.
 */
export async function comptesEnregistres(
  attenteMaxMs?: number,
): Promise<MicrosoftAccount[]> {
  await waitForApi(attenteMaxMs);

  // Un dernier filet: la liste est relue une fois si elle echoue malgre un
  // service qui repond, plutot que de renvoyer le joueur a l'ecran de connexion
  // sur un aller-retour local rate.
  try {
    return await listSavedAccounts();
  } catch {
    await new Promise((resoudre) => setTimeout(resoudre, 500));
    return listSavedAccounts();
  }
}

/**
 * Resultat d'un renouvellement de session.
 *
 * <p>Trois issues et non deux, parce que les confondre coutait une
 * reconnexion: le compte peut etre utilisable, definitivement perdu, ou
 * simplement pas renouvelable a cet instant -- reseau coupe au demarrage,
 * Xbox Live en panne. Le troisieme cas garde le compte et se retente.
 */
export type Renouvellement =
  | { etat: "ok"; compte: MicrosoftAccount }
  | { etat: "reconnexion" }
  | { etat: "reessayer"; raison: string };

export async function refreshAccount(
  accountId: string,
): Promise<Renouvellement> {
  try {
    const compte = await apiRequest<MicrosoftAccount>(
      `/v1/auth/accounts/${encodeURIComponent(accountId)}/refresh`,
      { method: "POST" },
    );
    return { etat: "ok", compte };
  } catch (err) {
    // 401 et 404 sont les deux reponses qui disent que ce compte n'existe
    // plus de notre cote: Microsoft a refuse son jeton, ou il a ete oublie.
    const status = err instanceof ErreurApi ? err.status : 0;
    if (status === 401 || status === 404) {
      return { etat: "reconnexion" };
    }
    return {
      etat: "reessayer",
      raison: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function forgetAccount(accountId: string): Promise<void> {
  await apiRequest<void>(
    `/v1/auth/accounts/${encodeURIComponent(accountId)}`,
    { method: "DELETE" },
  );
}

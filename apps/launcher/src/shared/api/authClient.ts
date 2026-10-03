import {
  MicrosoftAuthUrlResponse,
  MicrosoftAuthCallbackRequest,
  MicrosoftAccount,
} from "@paranoia/contracts";
import { apiRequest, ErreurApi } from "./http";

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

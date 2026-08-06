import {
  MicrosoftAuthUrlResponse,
  MicrosoftAuthCallbackRequest,
  MicrosoftAccount,
} from "@paranoia/contracts";
import { apiRequest } from "./http";

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
 * Renvoie une session utilisable, renouvelee si le jeton Minecraft a expire.
 * Retourne null quand il faut repasser par la connexion Microsoft.
 */
export async function refreshAccount(
  accountId: string,
): Promise<MicrosoftAccount | null> {
  try {
    return await apiRequest<MicrosoftAccount>(
      `/v1/auth/accounts/${encodeURIComponent(accountId)}/refresh`,
      { method: "POST" },
    );
  } catch {
    return null;
  }
}

export async function forgetAccount(accountId: string): Promise<void> {
  await apiRequest<void>(
    `/v1/auth/accounts/${encodeURIComponent(accountId)}`,
    { method: "DELETE" },
  );
}

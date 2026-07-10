import type {
  MicrosoftAccount,
  MicrosoftAuthUrlResponse,
  MicrosoftCallbackRequest
} from "@paranoia/contracts";
import { apiRequest } from "./http";

export async function getMicrosoftAuthorizeUrl(redirectUri?: string): Promise<MicrosoftAuthUrlResponse> {
  const query = redirectUri ? `?redirectUri=${encodeURIComponent(redirectUri)}` : "";
  return apiRequest<MicrosoftAuthUrlResponse>(`/v1/auth/microsoft/url${query}`);
}

export async function completeMicrosoftCallback(
  payload: MicrosoftCallbackRequest
): Promise<MicrosoftAccount> {
  return apiRequest<MicrosoftAccount>("/v1/auth/microsoft/callback", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

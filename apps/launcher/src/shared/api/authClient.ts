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

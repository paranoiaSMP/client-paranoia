import {
  MicrosoftAuthUrlResponse,
  MicrosoftAuthCallbackRequest,
  AuthAccount,
} from "@paranoia/contracts";

const API_URL = "http://localhost:8080/v1"; // TODO: Use environment variable

export async function getMicrosoftAuthorizeUrl(
  redirectUri: string,
): Promise<MicrosoftAuthUrlResponse> {
  const url = new URL(`${API_URL}/auth/microsoft/url`);
  url.searchParams.set("redirectUri", redirectUri);
  const response = await fetch(url.toString());
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to get authorize url");
  }
  return response.json();
}

export async function completeMicrosoftCallback(
  req: MicrosoftAuthCallbackRequest,
): Promise<AuthAccount> {
  const response = await fetch(`${API_URL}/auth/microsoft/callback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to complete authentication");
  }
  return response.json();
}

import { createHash, randomBytes } from "node:crypto";
import { env } from "../../config/env";

interface MicrosoftTokenResponse {
  token_type: string;
  scope: string;
  expires_in: number;
  access_token: string;
  refresh_token: string;
}

interface XboxUserTokenResponse {
  Token: string;
  DisplayClaims: {
    xui: Array<{ uhs: string }>;
  };
}

interface XstsTokenResponse {
  Token: string;
  DisplayClaims: {
    xui: Array<{ uhs: string }>;
  };
}

interface MinecraftLoginResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface MinecraftProfileResponse {
  id: string;
  name: string;
  skins?: Array<{ url: string }>;
}

export interface MicrosoftAuthResult {
  minecraftUuid: string;
  minecraftUsername: string;
  skinUrl: string;
  microsoftAccessToken: string;
  microsoftRefreshToken: string;
  minecraftAccessToken: string;
  expiresAt: string;
}

export function generatePkceVerifier(): string {
  return randomBytes(64).toString("base64url");
}

export function generatePkceChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildMicrosoftAuthorizeUrl(args: {
  state: string;
  codeChallenge: string;
  redirectUri: string;
}): string {
  const params = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
    response_type: "code",
    redirect_uri: args.redirectUri,
    scope: "XboxLive.signin offline_access",
    state: args.state,
    code_challenge: args.codeChallenge,
    code_challenge_method: "S256"
  });

  return `https://login.live.com/oauth20_authorize.srf?${params.toString()}`;
}

export async function completeMicrosoftAuth(args: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<MicrosoftAuthResult> {
  const microsoftToken = await exchangeCodeForMicrosoftToken(args);
  const xboxUser = await authenticateXboxUser(microsoftToken.access_token);
  const xsts = await authorizeXsts(xboxUser.Token);
  const uhs = xsts.DisplayClaims.xui[0]?.uhs;

  if (!uhs) {
    throw new Error("missing uhs in XSTS response");
  }

  const minecraft = await loginMinecraftWithXbox(uhs, xsts.Token);
  const profile = await fetchMinecraftProfile(minecraft.access_token);
  const skinUrl = profile.skins?.[0]?.url ?? "";

  return {
    minecraftUuid: profile.id,
    minecraftUsername: profile.name,
    skinUrl,
    microsoftAccessToken: microsoftToken.access_token,
    microsoftRefreshToken: microsoftToken.refresh_token,
    minecraftAccessToken: minecraft.access_token,
    expiresAt: new Date(Date.now() + microsoftToken.expires_in * 1000).toISOString()
  };
}

async function exchangeCodeForMicrosoftToken(args: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}): Promise<MicrosoftTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.MICROSOFT_CLIENT_ID,
    client_secret: env.MICROSOFT_CLIENT_SECRET,
    code: args.code,
    grant_type: "authorization_code",
    redirect_uri: args.redirectUri,
    code_verifier: args.codeVerifier
  });

  const response = await fetch("https://login.live.com/oauth20_token.srf", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`microsoft token exchange failed: ${message}`);
  }

  return (await response.json()) as MicrosoftTokenResponse;
}

async function authenticateXboxUser(msaAccessToken: string): Promise<XboxUserTokenResponse> {
  const response = await fetch("https://user.auth.xboxlive.com/user/authenticate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${msaAccessToken}`
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT"
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`xbox user auth failed: ${message}`);
  }

  return (await response.json()) as XboxUserTokenResponse;
}

async function authorizeXsts(userToken: string): Promise<XstsTokenResponse> {
  const response = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [userToken]
      },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT"
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`xsts authorize failed: ${message}`);
  }

  return (await response.json()) as XstsTokenResponse;
}

async function loginMinecraftWithXbox(uhs: string, xstsToken: string): Promise<MinecraftLoginResponse> {
  const response = await fetch("https://api.minecraftservices.com/authentication/login_with_xbox", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json"
    },
    body: JSON.stringify({
      identityToken: `XBL3.0 x=${uhs};${xstsToken}`
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`minecraft login failed: ${message}`);
  }

  return (await response.json()) as MinecraftLoginResponse;
}

async function fetchMinecraftProfile(minecraftAccessToken: string): Promise<MinecraftProfileResponse> {
  const response = await fetch("https://api.minecraftservices.com/minecraft/profile", {
    headers: {
      Authorization: `Bearer ${minecraftAccessToken}`,
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`minecraft profile fetch failed: ${message}`);
  }

  return (await response.json()) as MinecraftProfileResponse;
}

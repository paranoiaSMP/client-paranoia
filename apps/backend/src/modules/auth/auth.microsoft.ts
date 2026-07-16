import { env } from "../../config/env";

const MINECRAFT_CLIENT_ID = "00000000402b5328"; // Official Minecraft Client ID

export function getMicrosoftAuthorizeUrl(redirectUri: string) {
  const url = new URL("https://login.live.com/oauth20_authorize.srf");
  url.searchParams.set("client_id", MINECRAFT_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "XboxLive.signin offline_access");
  return { authorizeUrl: url.toString() };
}

export async function completeMicrosoftCallback(opts: {
  code: string;
  state: string;
  redirectUri: string;
}) {
  // 1. Exchange code for token
  const tokenParams = new URLSearchParams({
    client_id: MINECRAFT_CLIENT_ID,
    code: opts.code,
    grant_type: "authorization_code",
    redirect_uri: opts.redirectUri,
  });

  const tokenRes = await fetch("https://login.live.com/oauth20_token.srf", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenParams.toString(),
  });

  if (!tokenRes.ok) {
    const errorText = await tokenRes.text();
    throw new Error(`Failed to exchange code for token: ${errorText}`);
  }

  const tokenData = await tokenRes.json();
  const accessToken = tokenData.access_token;
  const refreshToken = tokenData.refresh_token;

  // 2. Authenticate with Xbox Live
  const xblRes = await fetch(
    "https://user.auth.xboxlive.com/user/authenticate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        Properties: {
          AuthMethod: "RPS",
          SiteName: "user.auth.xboxlive.com",
          RpsTicket: `d=${accessToken}`,
        },
        RelyingParty: "http://auth.xboxlive.com",
        TokenType: "JWT",
      }),
    },
  );

  if (!xblRes.ok) throw new Error("xbl authentication failed");
  const xblData = await xblRes.json();
  const xblToken = xblData.Token;
  const userHash = xblData.DisplayClaims.xui[0].uhs;

  // 3. Authenticate with XSTS
  const xstsRes = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [xblToken],
      },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    }),
  });

  if (!xstsRes.ok) {
    const err = await xstsRes.json();
    throw new Error(`xsts authentication failed: ${JSON.stringify(err)}`);
  }
  const xstsData = await xstsRes.json();
  const xstsToken = xstsData.Token;

  // 4. Authenticate with Minecraft
  const mcRes = await fetch(
    "https://api.minecraftservices.com/authentication/login_with_xbox",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
      }),
    },
  );

  if (!mcRes.ok) {
    const msg = await mcRes.text();
    throw new Error(`minecraft login failed: ${msg}`);
  }
  const mcData = await mcRes.json();
  const mcAccessToken = mcData.access_token;
  const mcExpiresIn = mcData.expires_in; // usually 86400 (24h)

  // 5. Get Minecraft Profile
  const profileRes = await fetch(
    "https://api.minecraftservices.com/minecraft/profile",
    {
      headers: {
        Authorization: `Bearer ${mcAccessToken}`,
      },
    },
  );

  if (!profileRes.ok) {
    const profileErr = await profileRes.text();
    if (profileRes.status === 404) {
      throw new Error("L'utilisateur n'a pas acheté Minecraft Java Edition");
    }
    throw new Error(`minecraft profile failed: ${profileErr}`);
  }

  const profileData = await profileRes.json();

  return {
    minecraftUuid: profileData.id,
    minecraftUsername: profileData.name,
    skinUrl: profileData.skins?.[0]?.url,
    minecraftAccessToken: mcAccessToken,
    microsoftRefreshToken: refreshToken,
    expiresAt: new Date(Date.now() + mcExpiresIn * 1000).toISOString(),
  };
}

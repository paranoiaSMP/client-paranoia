const MINECRAFT_CLIENT_ID = "00000000402b5328"; // Official Minecraft Client ID

const TOKEN_ENDPOINT = "https://login.live.com/oauth20_token.srf";

export interface MinecraftAccountTokens {
  minecraftUuid: string;
  minecraftUsername: string;
  skinUrl: string | undefined;
  minecraftAccessToken: string;
  microsoftRefreshToken: string;
  expiresAt: string;
}

export function getMicrosoftAuthorizeUrl(redirectUri: string, state: string) {
  const url = new URL("https://login.live.com/oauth20_authorize.srf");
  url.searchParams.set("client_id", MINECRAFT_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "XboxLive.signin offline_access openid profile email");
  url.searchParams.set("state", state);
  return { authorizeUrl: url.toString() };
}

async function requestOauthTokens(
  params: URLSearchParams,
): Promise<{ oauthToken: string; refreshToken: string }> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Failed to obtain Microsoft token: ${response.status}`);
  }

  const data = await response.json();
  return { oauthToken: data.access_token, refreshToken: data.refresh_token };
}

/**
 * Xbox Live -> XSTS -> Minecraft Services, then the player profile.
 * Shared by the initial login and the silent refresh so both stay in step.
 */
async function resolveMinecraftAccount(
  oauthToken: string,
  refreshToken: string,
): Promise<MinecraftAccountTokens> {
  const xblRes = await fetch("https://user.auth.xboxlive.com/user/authenticate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json",
    },
    body: JSON.stringify({
      Properties: {
        AuthMethod: "RPS",
        SiteName: "user.auth.xboxlive.com",
        RpsTicket: `d=${oauthToken}`,
      },
      RelyingParty: "http://auth.xboxlive.com",
      TokenType: "JWT",
    }),
  });

  if (!xblRes.ok) {
    throw new Error(`XBL authentication failed: ${xblRes.status}`);
  }
  const xblData = await xblRes.json();

  const xstsRes = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json",
    },
    body: JSON.stringify({
      Properties: {
        SandboxId: "RETAIL",
        UserTokens: [xblData.Token],
      },
      RelyingParty: "rp://api.minecraftservices.com/",
      TokenType: "JWT",
    }),
  });

  if (!xstsRes.ok) {
    throw new Error(`XSTS authentication failed: ${xstsRes.status}`);
  }
  const xstsData = await xstsRes.json();

  // Le UserHash est dans DisplayClaims.xui[0].uhs
  const userHash =
    xstsData?.DisplayClaims?.xui?.[0]?.uhs ||
    xblData.DisplayClaims?.xui?.[0]?.uhs;
  const xstsToken = xstsData.Token;

  const mcRes = await fetch(
    "https://api.minecraftservices.com/authentication/login_with_xbox",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Accept: "application/json",
        "User-Agent": "MinecraftLauncher/2.2.10675",
      },
      body: JSON.stringify({
        identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
        ensureLegacyEnabled: true,
      }),
    },
  );

  if (!mcRes.ok) {
    throw new Error(`minecraft login failed: ${mcRes.status}`);
  }
  const mcData = await mcRes.json();
  const mcAccessToken = mcData.access_token;
  const mcExpiresIn = mcData.expires_in;

  const profileRes = await fetch(
    "https://api.minecraftservices.com/minecraft/profile",
    {
      headers: { Authorization: `Bearer ${mcAccessToken}` },
    },
  );

  if (!profileRes.ok) {
    throw new Error(`Failed to fetch Minecraft profile: ${profileRes.status}`);
  }
  const profileData = await profileRes.json();
  console.log(`[AUTH] Successfully logged in as ${profileData.name}`);

  return {
    minecraftUuid: profileData.id,
    minecraftUsername: profileData.name,
    skinUrl: profileData.skins?.[0]?.url,
    minecraftAccessToken: mcAccessToken,
    microsoftRefreshToken: refreshToken,
    expiresAt: new Date(Date.now() + mcExpiresIn * 1000).toISOString(),
  };
}

export async function completeMicrosoftCallback(opts: {
  code: string;
  state: string;
  redirectUri: string;
}): Promise<MinecraftAccountTokens> {
  const { oauthToken, refreshToken } = await requestOauthTokens(
    new URLSearchParams({
      client_id: MINECRAFT_CLIENT_ID,
      code: opts.code,
      grant_type: "authorization_code",
      redirect_uri: opts.redirectUri,
    }),
  );

  return resolveMinecraftAccount(oauthToken, refreshToken);
}

/**
 * Trade a stored refresh token for a fresh Minecraft session, so a returning
 * player does not have to go through the Microsoft window again every day.
 */
export async function refreshMicrosoftAccount(
  microsoftRefreshToken: string,
): Promise<MinecraftAccountTokens> {
  const { oauthToken, refreshToken } = await requestOauthTokens(
    new URLSearchParams({
      client_id: MINECRAFT_CLIENT_ID,
      refresh_token: microsoftRefreshToken,
      grant_type: "refresh_token",
    }),
  );

  // Microsoft peut renvoyer le meme refresh token: on garde l'ancien si absent.
  return resolveMinecraftAccount(
    oauthToken,
    refreshToken || microsoftRefreshToken,
  );
}

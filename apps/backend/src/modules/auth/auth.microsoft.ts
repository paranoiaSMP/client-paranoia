import crypto from "crypto";

const MINECRAFT_CLIENT_ID = "00000000402b5328"; // Official Minecraft Client ID

export function getMicrosoftAuthorizeUrl(redirectUri: string, state: string) {
  const url = new URL("https://login.live.com/oauth20_authorize.srf");
  url.searchParams.set("client_id", MINECRAFT_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "XboxLive.signin offline_access openid profile email");
  url.searchParams.set("state", state);
  return { authorizeUrl: url.toString() };
}

export async function completeMicrosoftCallback(opts: {
  code: string;
  state: string;
  redirectUri: string;
}) {
  try {
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
      throw new Error(`Failed to exchange code for token: ${tokenRes.status}`);
    }

    const tokenData = await tokenRes.json();
    const oauthToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    // 2. Authenticate with Xbox Live
    const xblRes = await fetch(
      "https://user.auth.xboxlive.com/user/authenticate",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Accept": "application/json",
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
      }
    );

    if (!xblRes.ok) {
      throw new Error(`XBL authentication failed: ${xblRes.status}`);
    }
    const xblData = await xblRes.json();

    // 3. Authenticate with XSTS
    const xstsRes = await fetch(
      "https://xsts.auth.xboxlive.com/xsts/authorize",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          Properties: {
            SandboxId: "RETAIL",
            UserTokens: [xblData.Token],
          },
          RelyingParty: "rp://api.minecraftservices.com/",
          TokenType: "JWT",
        }),
      }
    );

    if (!xstsRes.ok) {
      throw new Error(`XSTS authentication failed: ${xstsRes.status}`);
    }
    const xstsData = await xstsRes.json();
    
    // Le UserHash est dans DisplayClaims.xui[0].uhs
    const userHash = xstsData?.DisplayClaims?.xui?.[0]?.uhs || xblData.DisplayClaims?.xui?.[0]?.uhs;
    const xstsToken = xstsData.Token;

    // 4. Authenticate with Minecraft
    const mcRes = await fetch(
      "https://api.minecraftservices.com/authentication/login_with_xbox",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Accept": "application/json",
          "User-Agent": "MinecraftLauncher/2.2.10675",
        },
        body: JSON.stringify({
          identityToken: `XBL3.0 x=${userHash};${xstsToken}`,
          ensureLegacyEnabled: true,
        }),
      }
    );

    if (!mcRes.ok) {
      throw new Error(`minecraft login failed: ${mcRes.status}`);
    }
    const mcData = await mcRes.json();
    const mcAccessToken = mcData.access_token;
    const mcExpiresIn = mcData.expires_in;

    // 5. Profil Minecraft (pour l'UUID et le pseudo)
    const profileRes = await fetch(
      "https://api.minecraftservices.com/minecraft/profile",
      {
        headers: {
          "Authorization": `Bearer ${mcAccessToken}`,
        },
      }
    );

    if (!profileRes.ok) {
      throw new Error(
        `Failed to fetch Minecraft profile: ${profileRes.status}`,
      );
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
  } catch (error) {
    console.error("[AUTH] FATAL ERROR in completeMicrosoftCallback:", error);
    throw error;
  }
}

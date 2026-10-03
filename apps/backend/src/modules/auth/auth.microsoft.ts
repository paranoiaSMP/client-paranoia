import { logger } from "../../logger.js";
const MINECRAFT_CLIENT_ID = "00000000402b5328"; // Official Minecraft Client ID

/**
 * Les quatre services de la chaine, surchargeables pour les bancs d'essai.
 *
 * <p>Meme procede que pour le manifeste de Mojang et pour Fabric: le banc
 * `test-auth-session.ts` les fait pointer vers un serveur local, ce qui permet
 * d'eprouver le renouvellement -- y compris ses pannes -- sans compte Microsoft
 * et sans reseau.
 */
const LIVE = () =>
  process.env.MICROSOFT_LOGIN_BASE_URL ?? "https://login.live.com";
const XBL = () =>
  process.env.XBOX_LIVE_BASE_URL ?? "https://user.auth.xboxlive.com";
const XSTS = () =>
  process.env.XBOX_XSTS_BASE_URL ?? "https://xsts.auth.xboxlive.com";
const MINECRAFT = () =>
  process.env.MINECRAFT_SERVICES_BASE_URL ?? "https://api.minecraftservices.com";

const TOKEN_ENDPOINT = () => `${LIVE()}/oauth20_token.srf`;

/**
 * Un renouvellement qui a echoue, et la seule question qui compte: faut-il
 * redemander au joueur de se connecter ?
 *
 * <p>La distinction n'est pas un raffinement. La chaine compte cinq appels
 * reseau -- Microsoft, Xbox Live, XSTS, Minecraft, le profil -- et la moindre
 * panne de l'un d'eux faisait jusqu'ici supprimer le compte enregistre. Le
 * joueur repassait par la fenetre Microsoft parce qu'un service tiers avait
 * hoquete trois secondes, et son jeton de renouvellement, lui, etait valide.
 *
 * <p>{@code definitif} n'est vrai que lorsque Microsoft refuse explicitement le
 * jeton de renouvellement (`invalid_grant`): expire, revoque, ou mot de passe
 * change. C'est le seul cas ou se reconnecter est reellement necessaire.
 */
export class EchecRenouvellement extends Error {
  readonly definitif: boolean;

  constructor(message: string, definitif: boolean) {
    super(message);
    this.name = "EchecRenouvellement";
    this.definitif = definitif;
  }
}

export interface MinecraftAccountTokens {
  minecraftUuid: string;
  minecraftUsername: string;
  skinUrl: string | undefined;
  minecraftAccessToken: string;
  microsoftRefreshToken: string;
  expiresAt: string;
}

export function getMicrosoftAuthorizeUrl(redirectUri: string, state: string) {
  const url = new URL(`${LIVE()}/oauth20_authorize.srf`);
  url.searchParams.set("client_id", MINECRAFT_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "XboxLive.signin offline_access openid profile email");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "select_account");
  return { authorizeUrl: url.toString() };
}

async function requestOauthTokens(
  params: URLSearchParams,
): Promise<{ oauthToken: string; refreshToken: string }> {
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT(), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    // Reseau coupe, DNS, portail captif: rien ne dit que le jeton est mort.
    throw new EchecRenouvellement(
      `Microsoft injoignable: ${err instanceof Error ? err.message : String(err)}`,
      false,
    );
  }

  if (!response.ok) {
    const corps = await response.text().catch(() => "");
    let code = "";
    try {
      code = (JSON.parse(corps) as { error?: string }).error ?? "";
    } catch {
      // Microsoft repond parfois du texte: on se rabat sur le code HTTP.
    }

    // `invalid_grant` est la seule reponse qui dise « ce jeton de
    // renouvellement ne vaut plus rien ». Tout le reste -- 500, 429, panne
    // passagere -- laisse le jeton valide, et supprimer le compte sur cette
    // base obligerait le joueur a se reconnecter pour rien.
    throw new EchecRenouvellement(
      `Microsoft a refuse le renouvellement (${response.status}${code ? ` ${code}` : ""})`,
      code === "invalid_grant",
    );
  }

  const data = await response.json();
  return { oauthToken: data.access_token, refreshToken: data.refresh_token };
}

/** Un appel de la chaine Xbox / Minecraft, dont l'echec n'est jamais definitif. */
async function etape(
  nom: string,
  url: string,
  init: RequestInit,
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch (err) {
    throw new EchecRenouvellement(
      `${nom} injoignable: ${err instanceof Error ? err.message : String(err)}`,
      false,
    );
  }

  if (!response.ok) {
    // Pas definitif, meme sur un 401: a ce stade Microsoft a deja accepte le
    // jeton de renouvellement. C'est le service d'en face qui ne va pas, et
    // une reconnexion n'y changerait rien.
    throw new EchecRenouvellement(`${nom} a repondu ${response.status}`, false);
  }
  return response;
}

/**
 * Xbox Live -> XSTS -> Minecraft Services, then the player profile.
 * Shared by the initial login and the silent refresh so both stay in step.
 */
async function resolveMinecraftAccount(
  oauthToken: string,
  refreshToken: string,
): Promise<MinecraftAccountTokens> {
  const xblRes = await etape("Xbox Live", `${XBL()}/user/authenticate`, {
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
  const xblData = await xblRes.json();

  const xstsRes = await etape("XSTS", `${XSTS()}/xsts/authorize`, {
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
  const xstsData = await xstsRes.json();

  // Le UserHash est dans DisplayClaims.xui[0].uhs
  const userHash =
    xstsData?.DisplayClaims?.xui?.[0]?.uhs ||
    xblData.DisplayClaims?.xui?.[0]?.uhs;
  const xstsToken = xstsData.Token;

  const mcRes = await etape(
    "Minecraft",
    `${MINECRAFT()}/authentication/login_with_xbox`,
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
  const mcData = await mcRes.json();
  const mcAccessToken = mcData.access_token;
  const mcExpiresIn = mcData.expires_in;

  const profileRes = await etape(
    "profil Minecraft",
    `${MINECRAFT()}/minecraft/profile`,
    { headers: { Authorization: `Bearer ${mcAccessToken}` } },
  );
  const profileData = await profileRes.json();
  logger.info(`[AUTH] Successfully logged in as ${profileData.name}`);

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
  // Trois essais, et non un seul. Le renouvellement a lieu au demarrage du
  // launcher, c'est-a-dire a l'instant precis ou le Wi-Fi n'est pas encore
  // revenu, ou le VPN se monte, ou le portail captif n'a pas ete valide. Un
  // seul essai transformait ces secondes-la en reconnexion complete.
  //
  // On s'arrete immediatement sur un refus definitif: reessayer ne ferait
  // qu'attendre pour la meme reponse.
  let derniere: unknown;

  for (let essai = 1; essai <= 3; essai++) {
    try {
      const { oauthToken, refreshToken } = await requestOauthTokens(
        new URLSearchParams({
          client_id: MINECRAFT_CLIENT_ID,
          refresh_token: microsoftRefreshToken,
          grant_type: "refresh_token",
        }),
      );

      // Microsoft peut renvoyer le meme refresh token: on garde l'ancien si
      // absent. Il peut aussi en renvoyer un nouveau, et c'est celui-la qu'il
      // faut enregistrer -- garder l'ancien ferait echouer le renouvellement
      // suivant.
      return await resolveMinecraftAccount(
        oauthToken,
        refreshToken || microsoftRefreshToken,
      );
    } catch (err) {
      derniere = err;
      if (err instanceof EchecRenouvellement && err.definitif) {
        throw err;
      }
      if (essai < 3) {
        logger.warn(
          `[AUTH] renouvellement en echec (essai ${essai}/3): ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        await new Promise((resoudre) => setTimeout(resoudre, essai * 1500));
      }
    }
  }

  throw derniere instanceof Error
    ? derniere
    : new EchecRenouvellement(String(derniere), false);
}

import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { normalizeUuid } from "../../lib/uuid.js";

export interface VerifiedProfile {
  uuid: string;
  username: string;
}

/**
 * Demande a Mojang si ce joueur a bien ouvert une session avec cet identifiant.
 *
 * <p>C'est la moitie serveur du protocole que tout serveur Minecraft en ligne
 * utilise pour authentifier ses joueurs. Le client appelle `join` avec son
 * jeton d'acces et un `serverId` qu'on lui a donne; nous appelons `hasJoined`
 * avec le meme `serverId`. Mojang ne repond que si les deux correspondent, ce
 * qui prouve que le joueur detient reellement le compte qu'il annonce.
 *
 * <p>Sans cette verification, l'API croirait n'importe qui sur parole: il
 * suffirait d'une requete HTTP pour faire apparaitre le badge Paranoia a cote
 * du pseudo de quelqu'un d'autre, ou pour s'attribuer ses cosmetiques.
 *
 * @returns le profil verifie, ou `null` si Mojang ne confirme pas.
 */
export async function verifySession(
  username: string,
  serverId: string,
): Promise<VerifiedProfile | null> {
  const url = new URL("/session/minecraft/hasJoined", env.MOJANG_SESSION_BASE_URL);
  url.searchParams.set("username", username);
  url.searchParams.set("serverId", serverId);

  let response: Response;
  try {
    response = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: { accept: "application/json" },
    });
  } catch (err) {
    // Mojang injoignable: on refuse la session sans rien affirmer sur le
    // joueur. Le mod reessaiera; c'est preferable a un badge accorde par
    // defaut quand la verification est en panne.
    logger.warn({ err }, "Session Mojang injoignable");
    return null;
  }

  // 204 est la reponse normale d'un echec: aucune session ne correspond.
  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    logger.warn({ status: response.status }, "Reponse inattendue de la session Mojang");
    return null;
  }

  const body = (await response.json()) as { id?: unknown; name?: unknown };
  if (typeof body.id !== "string" || typeof body.name !== "string") {
    return null;
  }

  const uuid = normalizeUuid(body.id);
  if (!uuid) {
    return null;
  }

  return { uuid, username: body.name };
}

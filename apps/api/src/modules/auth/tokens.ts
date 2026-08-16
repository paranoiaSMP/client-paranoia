import { randomBytes } from "node:crypto";

import { env } from "../../config/env.js";
import type { VerifiedProfile } from "./mojang.js";

interface Session extends VerifiedProfile {
  expiresAt: number;
}

/**
 * Defis en attente, et jetons emis.
 *
 * <p>Tout est en memoire, et c'est un choix: un redemarrage invalide les
 * jetons, le mod recoit un 401 et refait le handshake -- une seconde de
 * latence, invisible. Persister ces donnees imposerait une base a
 * administrer pour ne conserver que des secrets ephemeres.
 */
const challenges = new Map<string, number>();
const sessions = new Map<string, Session>();

const sweep = setInterval(() => {
  const now = Date.now();
  for (const [id, expiresAt] of challenges) {
    if (expiresAt <= now) {
      challenges.delete(id);
    }
  }
  for (const [token, session] of sessions) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}, 60_000);
sweep.unref();

/**
 * Cree un `serverId` a usage unique pour le handshake Mojang.
 *
 * <p>Court (32 caracteres hexadecimaux) parce que le champ `serverId` du
 * protocole n'est pas prevu pour de longues chaines, et aleatoire pour qu'un
 * tiers ne puisse pas preparer une session a l'avance.
 */
export function issueChallenge(): string {
  const serverId = randomBytes(16).toString("hex");
  challenges.set(serverId, Date.now() + 60_000);
  return serverId;
}

/**
 * Valide un defi et le consomme.
 *
 * <p>Usage unique: rejouer un `serverId` deja utilise ne doit pas redonner un
 * jeton, meme si l'enregistrement cote Mojang est encore chaud.
 */
export function consumeChallenge(serverId: string): boolean {
  const expiresAt = challenges.get(serverId);
  if (expiresAt === undefined) {
    return false;
  }

  challenges.delete(serverId);
  return expiresAt > Date.now();
}

export function issueToken(profile: VerifiedProfile): { token: string; expiresIn: number } {
  const token = randomBytes(32).toString("base64url");
  sessions.set(token, {
    ...profile,
    expiresAt: Date.now() + env.TOKEN_TTL_SECONDS * 1000,
  });

  return { token, expiresIn: env.TOKEN_TTL_SECONDS };
}

export function resolveToken(token: string): VerifiedProfile | null {
  const session = sessions.get(token);
  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return { uuid: session.uuid, username: session.username };
}

/** Uniquement pour les tests: repart d'un etat vide. */
export function resetAuthState(): void {
  challenges.clear();
  sessions.clear();
}

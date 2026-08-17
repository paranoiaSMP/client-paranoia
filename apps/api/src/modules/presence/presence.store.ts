import { env } from "../../config/env.js";

/**
 * Qui est en jeu avec le client Paranoia, en ce moment.
 *
 * <p>Volontairement ephemere: on ne stocke que `uuid -> instant d'expiration`,
 * jamais l'adresse du serveur ou le joueur se trouve, jamais un historique.
 * Un joueur qui ferme le jeu disparait de la memoire du service en moins de
 * deux minutes, sans qu'il reste trace de son passage.
 */
const online = new Map<string, number>();

const sweep = setInterval(() => {
  const now = Date.now();
  for (const [uuid, expiresAt] of online) {
    if (expiresAt <= now) {
      online.delete(uuid);
    }
  }
}, 30_000);
sweep.unref();

export function touch(uuid: string): void {
  online.set(uuid, Date.now() + env.PRESENCE_TTL_SECONDS * 1000);
}

export function isOnline(uuid: string): boolean {
  const expiresAt = online.get(uuid);
  if (expiresAt === undefined) {
    return false;
  }

  // On verifie l'expiration a la lecture plutot que de se fier au balayage:
  // entre deux passages, une entree perimee repondrait encore "en ligne".
  if (expiresAt <= Date.now()) {
    online.delete(uuid);
    return false;
  }

  return true;
}

export function onlineCount(): number {
  const now = Date.now();
  let count = 0;
  for (const expiresAt of online.values()) {
    if (expiresAt > now) {
      count += 1;
    }
  }
  return count;
}

/** Uniquement pour les tests. */
export function resetPresence(): void {
  online.clear();
}

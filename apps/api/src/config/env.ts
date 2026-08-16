import "dotenv/config";
import { z } from "zod";

/**
 * Configuration du service heberge.
 *
 * <p>A ne pas confondre avec `apps/backend`, qui tourne sur la machine du
 * joueur. Celui-ci tourne sur le VPS, est joignable par n'importe qui, et
 * n'a donc aucune des libertes qu'on s'autorise en local.
 */
const envSchema = z.object({
  // 8080 et pas 47820: le port du sidecar local n'a aucune raison d'etre
  // repris ici, et un reverse proxy ecoute de toute facon sur 443 devant.
  PORT: z.string().default("8080"),
  HOST: z.string().default("127.0.0.1"),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  /**
   * Nombre de proxys de confiance devant le service.
   *
   * <p>Determine quelle valeur de `X-Forwarded-For` fait foi pour la limite de
   * debit. Avec Caddy ou nginx en frontal, c'est 1. Mettre 0 en production
   * ferait compter toutes les requetes du monde sur la meme IP -- celle du
   * proxy -- et le premier joueur actif bloquerait tous les autres.
   */
  TRUST_PROXY: z.coerce.number().int().min(0).max(10).default(1),

  CORS_ALLOWED_ORIGINS: z.string().default(""),

  /** Fichier des cosmetiques, relu a chaud quand il change. */
  COSMETICS_FILE: z.string().default("./data/cosmetics.json"),

  /**
   * Duree pendant laquelle un joueur reste "en ligne" sans donner signe de vie.
   *
   * <p>Genereusement superieur a l'intervalle de heartbeat: un lag de quelques
   * secondes ne doit pas faire clignoter les badges de tout le monde.
   */
  PRESENCE_TTL_SECONDS: z.coerce.number().int().positive().default(90),
  HEARTBEAT_INTERVAL_SECONDS: z.coerce.number().int().positive().default(30),

  /** Duree de vie d'un jeton d'API avant re-authentification. */
  TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(43200),

  /**
   * Plafond d'UUID par requete de lookup.
   *
   * <p>Un onglet de joueurs depasse rarement 200 entrees; le mod decoupe
   * au-dela. Le plafond existe pour qu'une requete unique ne puisse pas
   * demander l'etat de la base entiere.
   */
  LOOKUP_MAX_UUIDS: z.coerce.number().int().positive().max(2000).default(500),

  /** Requetes par minute et par IP, toutes routes confondues. */
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(120),

  MOJANG_SESSION_BASE_URL: z.string().url().default("https://sessionserver.mojang.com"),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  allowedOrigins: parsed.CORS_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
};

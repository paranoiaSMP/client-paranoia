import cors from "cors";
import express from "express";
import pino from "pino";
import { initDiscordRPC } from './modules/discord/discord.service.js';
import { pinoHttp } from "pino-http";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { catalogRouter } from "./modules/catalog/catalog.routes.js";
import { cosmeticsRouter } from "./modules/cosmetics/cosmetics.routes.js";
import { newsRouter } from "./modules/news/news.routes.js";
import { profilesRouter } from "./modules/profiles/profiles.routes.js";
import { serverStatusRouter } from "./modules/server-status/server-status.routes.js";
import { telemetryRouter } from "./modules/telemetry/telemetry.routes.js";
import { updatesRouter } from "./modules/updates/updates.routes.js";
import { launcherRouter } from "./modules/launcher/launcher.routes.js";
import { modsRouter } from "./modules/mods/modrinth.routes.js";
import { ModrinthUnavailableError } from "./modules/mods/modrinth.service.js";

const app = express();
const logger = pino({ level: "info" });

// L'API tourne sur la machine du joueur: avec un CORS ouvert, n'importe quel
// site visite dans un navigateur pouvait appeler /v1/launcher/play ou lire les
// profils. On n'autorise que les origines du launcher (voir env.allowedOrigins);
// les requetes sans Origin (clients natifs, curl) restent acceptees.
app.use(
  cors({
    origin(origin, callback) {
      // false = pas d'en-tete CORS renvoye, donc le navigateur bloque la
      // lecture (et le preflight des POST JSON echoue avant l'envoi).
      callback(null, !origin || env.allowedOrigins.includes(origin));
    },
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(pinoHttp({ logger }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "paranoia-backend" });
});

app.use("/v1/auth", authRouter);
app.use("/v1/catalog", catalogRouter);
app.use("/v1/cosmetics", cosmeticsRouter);
app.use("/v1/news", newsRouter);
app.use("/v1/profiles", profilesRouter);
app.use("/v1/server-status", serverStatusRouter);
app.use("/v1/updates", updatesRouter);
app.use("/v1/telemetry", telemetryRouter);
app.use("/v1/launcher", launcherRouter);
app.use("/v1/mods", modsRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    if (err instanceof ZodError) {
      return res.status(400).json({
        message: "validation error",
        issues: err.issues,
      });
    }

    // Panne d'un service tiers: le message est destine au joueur et ne revele
    // rien de la machine, contrairement a une erreur interne.
    if (err instanceof ModrinthUnavailableError) {
      logger.warn({ err }, "modrinth unavailable");
      return res.status(502).json({ message: err.message });
    }

    // Le detail part dans les logs serveur, pas dans la reponse: err.message
    // pouvait contenir un chemin absolu, une URL interne ou un extrait de
    // reponse d'un service tiers.
    logger.error({ err }, "unhandled error");
    return res.status(500).json({ message: "internal server error" });
  },
);

initDiscordRPC();

app.listen(Number(env.PORT), () => {
  logger.info(`Paranoia API listening on :${env.PORT}`);
});

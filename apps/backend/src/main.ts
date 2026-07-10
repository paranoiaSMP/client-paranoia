import cors from "cors";
import express from "express";
import pino from "pino";
import pinoHttp from "pino-http";
import { ZodError } from "zod";
import { env } from "./config/env";
import { authRouter } from "./modules/auth/auth.routes";
import { catalogRouter } from "./modules/catalog/catalog.routes";
import { cosmeticsRouter } from "./modules/cosmetics/cosmetics.routes";
import { newsRouter } from "./modules/news/news.routes";
import { profilesRouter } from "./modules/profiles/profiles.routes";
import { serverStatusRouter } from "./modules/server-status/server-status.routes";
import { telemetryRouter } from "./modules/telemetry/telemetry.routes";
import { updatesRouter } from "./modules/updates/updates.routes";

const app = express();
const logger = pino({ level: "info" });

app.use(cors());
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

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "validation error",
      issues: err.issues
    });
  }

  if (err instanceof Error) {
    return res.status(500).json({ message: err.message });
  }

  return res.status(500).json({ message: "unknown server error" });
});

app.listen(Number(env.PORT), () => {
  logger.info(`Paranoia API listening on :${env.PORT}`);
});

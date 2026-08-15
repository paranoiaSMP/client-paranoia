import cors from "cors";
import express from "express";

import { env } from "./config/env.js";
import { httpLogger } from "./lib/logger.js";
import { rateLimit } from "./lib/rateLimit.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { cosmeticsRouter } from "./modules/cosmetics/cosmetics.routes.js";
import { presenceRouter } from "./modules/presence/presence.routes.js";
import { usersRouter } from "./modules/users/users.routes.js";

export function createApp() {
  const app = express();

  // Sans cela, `req.ip` vaut l'adresse du reverse proxy pour tout le monde et
  // la limite de debit devient une limite globale.
  app.set("trust proxy", env.TRUST_PROXY);
  app.disable("x-powered-by");

  app.use(httpLogger);

  // 64 ko: un lookup de 500 identifiants pese une vingtaine de kilo-octets.
  // Le defaut d'Express (100 ko) n'est pas dangereux, mais rien ici n'a de
  // raison d'accepter davantage.
  app.use(express.json({ limit: "64kb" }));

  if (env.allowedOrigins.length > 0) {
    app.use(cors({ origin: env.allowedOrigins }));
  }

  app.use(rateLimit(env.RATE_LIMIT_PER_MINUTE));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/v1/auth", authRouter);
  app.use("/v1/presence", presenceRouter);
  app.use("/v1/users", usersRouter);
  app.use("/v1/cosmetics", cosmeticsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Route inconnue" });
  });

  return app;
}

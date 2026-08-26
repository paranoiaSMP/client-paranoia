import cors from "cors";
import express from "express";
import { resolve } from "node:path";

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

  // Textures des cosmetiques, servies telles quelles.
  //
  // `express.static` refuse deja les chemins qui remontent hors du dossier,
  // mais on restreint en plus aux extensions d'image: ce dossier est celui
  // ou l'on depose des fichiers a la main, et une erreur de copie ne doit
  // pas rendre un .env ou une cle publiquement telechargeable.
  const IMAGE = /\.(png|jpe?g|webp)$/i;

  app.use(
    "/cosmetics",
    // Le filtre passe avant, pas apres: une fois que `express.static` a
    // repondu, il est trop tard pour refuser. Ce dossier recoit des fichiers
    // deposes a la main, et une copie maladroite ne doit pas rendre un .env
    // publiquement telechargeable.
    (req, res, next) => {
      if (!IMAGE.test(req.path)) {
        res.status(404).json({ error: "Texture inconnue" });
        return;
      }
      next();
    },
    express.static(resolve(env.COSMETICS_ASSETS_DIR), {
      index: false,
      dotfiles: "ignore",
      // Une heure, avec ETag: le mod revalide sans retelecharger, et
      // remplacer une texture se propage dans l'heure sans purge a faire.
      maxAge: "1h",
      setHeaders: (res) => {
        // Ouvert a toutes les origines, et c'est necessaire, pas laxiste.
        //
        // Une image posee en fond CSS s'affiche sans rien demander, mais la
        // charger dans une texture WebGL -- ce que fait l'apercu 3D du
        // vestiaire -- oblige le navigateur a verifier que le serveur
        // l'autorise. Sans cet en-tete, l'apercu reste vide sans qu'aucune
        // erreur visible n'explique pourquoi.
        //
        // Aucun risque a l'accorder ici: ces fichiers sont des images
        // publiques, servies sans cookie ni jeton. Il n'y a rien a proteger
        // qu'un lien direct ne donnerait pas deja.
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      },
    }),
    (_req, res) => {
      res.status(404).json({ error: "Texture inconnue" });
    },
  );

  app.use("/v1/auth", authRouter);
  app.use("/v1/presence", presenceRouter);
  app.use("/v1/users", usersRouter);
  app.use("/v1/cosmetics", cosmeticsRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Route inconnue" });
  });

  return app;
}

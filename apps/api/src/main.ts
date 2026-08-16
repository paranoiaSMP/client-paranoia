import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { loadCosmetics, watchCosmetics } from "./modules/cosmetics/cosmetics.store.js";

loadCosmetics();
watchCosmetics();

const app = createApp();

// Ecoute sur 127.0.0.1 par defaut: le service n'a aucune raison d'etre
// joignable directement depuis Internet. Le reverse proxy, lui seul exposé,
// termine TLS et transmet en local.
const server = app.listen(Number(env.PORT), env.HOST, () => {
  logger.info({ host: env.HOST, port: env.PORT }, "API Paranoia demarree");
});

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    logger.info({ signal }, "Arret demande");
    server.close(() => process.exit(0));
  });
}

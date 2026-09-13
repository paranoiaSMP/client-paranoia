import pino from "pino";

/**
 * Le journal du backend, partage par tous les modules.
 *
 * <p>Il existait deja, mais construit dans {@code main.ts} et jamais exporte:
 * aucun module ne pouvait l'atteindre. Vingt-trois endroits retombaient donc
 * sur {@code console.log}, sans niveau, sans horodatage et sans moyen d'etre
 * coupes en production. Ce n'etait pas de la negligence -- il n'y avait
 * simplement pas de couture pour le prendre.
 *
 * <p>Une exception assumee: dans {@code launcher.service.ts}, la sortie de
 * Minecraft continue de passer par {@code console.log}. Elle est deja doublee
 * d'un {@code addLog} qui alimente le visualiseur de l'application, et
 * l'envelopper en JSON rendrait illisible ce qui est justement lu a l'oeil.
 */
export const logger = pino({ level: process.env.LOG_LEVEL ?? "info" });

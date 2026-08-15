import { readFileSync, watch } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { normalizeUuid } from "../../lib/uuid.js";

const itemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["cape", "wings", "halo", "hat", "particle", "emote"]),
  name: z.string().min(1),
  previewUrl: z.string().url(),
  /** Texture reellement portee en jeu, quand elle differe de l'apercu. */
  textureUrl: z.string().url().optional(),
  rarity: z.enum(["common", "rare", "epic", "legendary"]),
});

const fileSchema = z.object({
  items: z.array(itemSchema).default([]),
  players: z
    .record(
      z.object({
        owned: z.array(z.string()).default([]),
        equipped: z.array(z.string()).default([]),
      }),
    )
    .default({}),
});

export type CosmeticDefinition = z.infer<typeof itemSchema>;

interface Catalog {
  items: CosmeticDefinition[];
  /** UUID normalise -> identifiants d'objets reellement portes. */
  equipped: Map<string, string[]>;
}

let catalog: Catalog = { items: [], equipped: new Map() };

/**
 * Relit le fichier des cosmetiques.
 *
 * <p>Une erreur ne remplace jamais le catalogue en place. Le fichier est
 * edite a la main sur le VPS: une virgule oubliee ne doit pas faire
 * disparaitre les cosmetiques de tout le monde jusqu'au prochain
 * redemarrage. On journalise, on garde l'ancien etat, et l'edition suivante
 * repare.
 */
export function loadCosmetics(): void {
  const path = resolve(env.COSMETICS_FILE);

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch (err) {
    // Absence de fichier = pas encore de cosmetiques. Ce n'est pas une panne:
    // le service doit demarrer sans, et le badge fonctionne independamment.
    logger.info({ path }, "Aucun fichier de cosmetiques, catalogue vide");
    return;
  }

  let parsed: z.infer<typeof fileSchema>;
  try {
    parsed = fileSchema.parse(JSON.parse(raw));
  } catch (err) {
    logger.error({ err, path }, "Fichier de cosmetiques illisible, ancien catalogue conserve");
    return;
  }

  const known = new Set(parsed.items.map((item) => item.id));
  const equipped = new Map<string, string[]>();

  for (const [rawUuid, entry] of Object.entries(parsed.players)) {
    const uuid = normalizeUuid(rawUuid);
    if (!uuid) {
      logger.warn({ rawUuid }, "Identifiant de joueur ignore dans les cosmetiques");
      continue;
    }

    const owned = new Set(entry.owned);
    // Porter ce qu'on ne possede pas, ou un objet qui n'existe plus dans le
    // catalogue, est une incoherence d'edition: on la signale et on l'ecarte
    // plutot que de servir une reference que le mod ne saura pas resoudre.
    const worn = entry.equipped.filter((id) => {
      if (!known.has(id)) {
        logger.warn({ uuid, id }, "Cosmetique porte mais absent du catalogue");
        return false;
      }
      if (!owned.has(id)) {
        logger.warn({ uuid, id }, "Cosmetique porte mais non possede");
        return false;
      }
      return true;
    });

    if (worn.length > 0) {
      equipped.set(uuid, worn);
    }
  }

  catalog = { items: parsed.items, equipped };
  logger.info(
    { items: parsed.items.length, porteurs: equipped.size },
    "Catalogue de cosmetiques charge",
  );
}

/**
 * Recharge a chaud quand le fichier change.
 *
 * <p>Ajouter une cape a quelqu'un ne doit pas demander de couper le service
 * -- ce qui deconnecterait tous les jetons en cours et ferait clignoter les
 * badges de tous les joueurs connectes.
 */
export function watchCosmetics(): void {
  const path = resolve(env.COSMETICS_FILE);

  try {
    let pending: NodeJS.Timeout | undefined;
    watch(path, () => {
      // Un enregistrement declenche souvent deux evenements; on attend que
      // l'editeur ait fini d'ecrire avant de relire.
      clearTimeout(pending);
      pending = setTimeout(loadCosmetics, 250);
    }).unref();
  } catch {
    logger.info({ path }, "Fichier de cosmetiques non surveille (absent au demarrage)");
  }
}

export function catalogItems(): CosmeticDefinition[] {
  return catalog.items;
}

export function equippedFor(uuid: string): string[] {
  return catalog.equipped.get(uuid) ?? [];
}

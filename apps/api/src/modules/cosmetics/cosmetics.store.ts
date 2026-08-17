import { readFileSync, watch } from "node:fs";
import { resolve } from "node:path";

import { z } from "zod";

import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { normalizeUuid } from "../../lib/uuid.js";
import { playerState } from "./state.store.js";

const itemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["cape", "wings", "halo", "hat", "particle", "emote"]),
  name: z.string().min(1),
  previewUrl: z.string().url(),
  /** Texture reellement portee en jeu, quand elle differe de l'apercu. */
  textureUrl: z.string().url().optional(),
  rarity: z.enum(["common", "rare", "epic", "legendary"]),
  /** Prix en paracoins. 0 = offert a tout le monde. */
  price: z.number().int().min(0).default(0),
});

const fileSchema = z.object({
  /**
   * Comptes aux paracoins illimites, par UUID.
   *
   * <p>Par UUID et jamais par pseudo: un pseudo Minecraft se change, et
   * celui qu'on libere redevient disponible pour n'importe qui. Une liste
   * d'admins par pseudo se transfererait donc toute seule au premier venu
   * qui reprend le nom.
   */
  admins: z.array(z.string()).default([]),
  items: z.array(itemSchema).default([]),
  players: z
    .record(
      z.object({
        /** Paracoins accordes a la main. Les depenses viennent de l'etat. */
        balance: z.number().int().min(0).default(0),
        owned: z.array(z.string()).default([]),
        equipped: z.array(z.string()).default([]),
      }),
    )
    .default({}),
});

export type CosmeticDefinition = z.infer<typeof itemSchema>;

interface GrantedPlayer {
  balance: number;
  owned: string[];
  equipped: string[];
}

interface Catalog {
  items: CosmeticDefinition[];
  byId: Map<string, CosmeticDefinition>;
  admins: Set<string>;
  /** UUID normalise -> ce que l'edition manuelle lui accorde. */
  granted: Map<string, GrantedPlayer>;
}

let catalog: Catalog = {
  items: [],
  byId: new Map(),
  admins: new Set(),
  granted: new Map(),
};

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
  const granted = new Map<string, GrantedPlayer>();

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

    granted.set(uuid, { balance: entry.balance, owned: [...owned], equipped: worn });
  }

  const admins = new Set<string>();
  for (const rawUuid of parsed.admins) {
    const uuid = normalizeUuid(rawUuid);
    if (uuid) {
      admins.add(uuid);
    } else {
      logger.warn({ rawUuid }, "Admin ignore: ce n'est pas un UUID");
    }
  }

  catalog = {
    items: parsed.items,
    byId: new Map(parsed.items.map((item) => [item.id, item])),
    admins,
    granted,
  };
  logger.info(
    { items: parsed.items.length, joueurs: granted.size, admins: admins.size },
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

export function itemById(id: string): CosmeticDefinition | undefined {
  return catalog.byId.get(id);
}

export function isAdmin(uuid: string): boolean {
  return catalog.admins.has(uuid);
}

/** Ce que l'edition manuelle accorde a ce joueur, avant ses propres achats. */
export function grantedFor(uuid: string): GrantedPlayer {
  return catalog.granted.get(uuid) ?? { balance: 0, owned: [], equipped: [] };
}

/**
 * Objets reellement possedes: donnes a la main, plus achetes.
 *
 * <p>L'union et non l'un ou l'autre: retirer un objet du catalogue ne doit
 * pas reprendre celui qu'un joueur a paye, et un achat ne doit pas effacer
 * un don.
 */
export function ownedBy(uuid: string): string[] {
  const union = new Set(grantedFor(uuid).owned);
  for (const id of playerState(uuid).owned) {
    union.add(id);
  }
  return [...union];
}

/**
 * Paracoins restants. `null` signifie illimite.
 *
 * <p>Les admins ne detiennent pas un tres grand nombre: le controle de solde
 * est purement contourne pour eux. Un nombre finirait par etre decremente,
 * affiche, compare -- et un jour epuise.
 */
export function balanceOf(uuid: string): number | null {
  if (isAdmin(uuid)) {
    return null;
  }
  return Math.max(0, grantedFor(uuid).balance - playerState(uuid).spent);
}

/**
 * Ce que le joueur porte, en ecartant ce qu'il ne possede plus.
 *
 * <p>Son propre choix prime sur celui du catalogue; sans choix de sa part,
 * l'equipement accorde a la main s'applique.
 */
export function equippedFor(uuid: string): string[] {
  const chosen = playerState(uuid).equipped;
  const wanted = chosen ?? grantedFor(uuid).equipped;
  if (wanted.length === 0) {
    return [];
  }

  const owned = new Set(ownedBy(uuid));
  return wanted.filter((id) => owned.has(id) && catalog.byId.has(id));
}

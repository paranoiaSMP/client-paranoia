import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { z } from "zod";

import { env } from "../../config/env.js";
import { logger } from "../../lib/logger.js";
import { normalizeUuid } from "../../lib/uuid.js";

/**
 * Ce que les joueurs ont change eux-memes: achats et equipement.
 *
 * <p>Deliberement separe de `cosmetics.json`, qui reste edite a la main. Si
 * l'API reecrivait ce fichier, chaque achat effacerait les commentaires, les
 * dons manuels et la mise en forme -- et une edition faite au meme moment
 * serait perdue. Ici, personne n'ecrit dans le fichier de l'autre.
 *
 * <p>La lecture fusionne les deux: possede = donne a la main + achete,
 * solde = credit a la main - depense. Recharger un joueur se fait donc en
 * augmentant son solde dans le catalogue, sans toucher a son historique.
 */
const stateSchema = z.object({
  players: z
    .record(
      z.object({
        /** Total depense, retranche du solde accorde dans le catalogue. */
        spent: z.number().int().min(0).default(0),
        owned: z.array(z.string()).default([]),
        /** Absent tant que le joueur n'a rien change lui-meme. */
        equipped: z.array(z.string()).optional(),
      }),
    )
    .default({}),
});

export interface PlayerState {
  spent: number;
  owned: string[];
  /**
   * Absent tant que le joueur n'a rien change lui-meme.
   *
   * <p>`undefined` explicite dans le type, et non seulement optionnel: le
   * projet compile avec `exactOptionalPropertyTypes`, qui distingue « champ
   * absent » de « champ present valant undefined ». La distinction porte du
   * sens ici -- une liste vide veut dire « je ne porte rien », l'absence
   * veut dire « je m'en remets a ce que le catalogue accorde ».
   */
  equipped?: string[] | undefined;
}

type State = z.infer<typeof stateSchema>;

let state: State = { players: {} };

function statePath(): string {
  return resolve(env.COSMETICS_STATE_FILE);
}

export function loadState(): void {
  const path = statePath();

  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    logger.info({ path }, "Aucun etat de cosmetiques, on part de zero");
    state = { players: {} };
    return;
  }

  try {
    const parsed = stateSchema.parse(JSON.parse(raw));

    // Normalisation a la lecture: un fichier edite a la main pourrait
    // contenir des UUID sans tirets, qui ne correspondraient alors jamais.
    const players: State["players"] = {};
    for (const [rawUuid, entry] of Object.entries(parsed.players)) {
      const uuid = normalizeUuid(rawUuid);
      if (uuid) {
        players[uuid] = entry;
      }
    }
    state = { players };
  } catch (err) {
    // On refuse de demarrer sur un etat illisible: contrairement au
    // catalogue, celui-ci contient ce que les joueurs ont paye. Repartir
    // d'un fichier vide leur reprendrait leurs achats en silence.
    logger.error({ err, path }, "Etat des cosmetiques illisible");
    throw err;
  }
}

export function playerState(uuid: string): PlayerState {
  return state.players[uuid] ?? { spent: 0, owned: [] };
}

/**
 * Applique une modification et l'ecrit sur disque.
 *
 * <p>Ecriture atomique: fichier temporaire puis renommage. Une coupure de
 * courant pendant un `writeFileSync` direct laisserait un JSON tronque,
 * c'est-a-dire l'etat illisible que `loadState` refuse -- le service ne
 * redemarrerait plus.
 */
export function mutate(uuid: string, change: (current: PlayerState) => PlayerState): PlayerState {
  const updated = change(playerState(uuid));
  state.players[uuid] = updated;

  const path = statePath();
  const temporary = `${path}.tmp`;

  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(temporary, JSON.stringify(state, null, 2), "utf8");
    renameSync(temporary, path);
  } catch (err) {
    logger.error({ err, path }, "Ecriture de l'etat impossible");
    throw err;
  }

  return updated;
}

/** Uniquement pour les tests. */
export function resetState(): void {
  state = { players: {} };
}

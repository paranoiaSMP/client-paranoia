import { useSyncExternalStore } from "react";

/**
 * Les habillages saisonniers.
 *
 * <p>Un habillage ne touche ni la mise en page ni le comportement: il pose un
 * attribut {@code data-season} sur la racine, et la feuille de styles remplace
 * les jetons de couleur dessous. Tout ce qui lit {@code --color-accent} et ses
 * voisins change donc de teinte sans qu'aucun composant ait a le savoir.
 *
 * <p>La periode est fixe et non configurable a distance: un theme qui depend
 * du reseau pour s'afficher clignoterait au demarrage.
 */
export type Season = "halloween" | "none";

/** Choix du joueur: forcer l'habillage, le couper, ou suivre le calendrier. */
type Preference = "halloween" | "off" | null;

const STORAGE_KEY = "paranoia_season";

/**
 * Du 15 octobre au 2 novembre inclus. Le 2 et non le 1er: la soiree du 31 se
 * termine apres minuit, et un theme qui disparait pendant l'event serait pire
 * que pas de theme du tout.
 */
function inHalloweenWindow(now: Date): boolean {
	const month = now.getMonth();
	const day = now.getDate();
	return (month === 9 && day >= 15) || (month === 10 && day <= 2);
}

function readPreference(): Preference {
	try {
		const value = localStorage.getItem(STORAGE_KEY);
		return value === "halloween" || value === "off" ? value : null;
	} catch {
		return null;
	}
}

/** Hors periode, l'habillage est coupe quoi qu'en dise la preference. */
function resolve(now = new Date()): Season {
	if (!inHalloweenWindow(now)) return "none";
	return readPreference() === "off" ? "none" : "halloween";
}

const listeners = new Set<() => void>();
let current: Season = resolve();

function apply(season: Season) {
	current = season;
	if (season === "none") {
		delete document.documentElement.dataset.season;
	} else {
		document.documentElement.dataset.season = season;
	}
	for (const listener of listeners) listener();
}

/** A appeler avant le premier rendu, pour ne pas peindre une image violette puis orange. */
export function applySeasonAtBoot() {
	apply(resolve());
}

export function setSeasonEnabled(enabled: boolean) {
	try {
		localStorage.setItem(STORAGE_KEY, enabled ? "halloween" : "off");
	} catch {
		// Stockage indisponible: le choix vaut pour la session seulement.
	}
	apply(enabled ? "halloween" : "none");
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

/**
 * L'habillage courant, et s'il peut etre bascule: le bouton n'a de sens que
 * pendant la periode, hors d'elle il n'y a rien a activer.
 */
export function useSeason() {
	const season = useSyncExternalStore(subscribe, () => current);
	return {
		season,
		available: inHalloweenWindow(new Date()),
		toggle: () => setSeasonEnabled(season === "none"),
	};
}

/** Jours restants avant le 31 octobre: 0 le jour meme, null une fois passe. */
export function daysUntilHalloween(now = new Date()): number | null {
	const target = new Date(now.getFullYear(), 9, 31);
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const days = Math.round((target.getTime() - today.getTime()) / 86_400_000);
	return days >= 0 ? days : null;
}

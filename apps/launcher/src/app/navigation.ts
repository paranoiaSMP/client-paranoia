import {
	Home,
	Layers,
	Puzzle,
	Shirt,
	SlidersHorizontal,
	Store,
	Terminal,
	UserCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/**
 * Les ecrans de la barre laterale.
 *
 * <p>Ils remplacent l'union {@code ActiveModal}, qui melangeait deux choses de
 * nature differente: les destinations -- mods, comptes, parametres -- et les
 * fenetres qui s'ouvrent par-dessus une destination, comme l'assistant de
 * creation. Les premieres sont maintenant des ecrans que la barre laterale
 * designe, les secondes sont restees des fenetres.
 */
export type Screen =
	| "home"
	| "versions"
	| "profile"
	| "import"
	| "mods"
	| "cosmetics"
	| "shop"
	| "accounts"
	| "settings"
	| "logs";

/** Ce qui s'ouvre par-dessus l'ecran courant, sans le remplacer. */
export type Overlay = "none" | "create_profile" | "report_bug";

/**
 * Les ecrans qui ne sont pas dans la barre laterale, avec celui qu'elle doit
 * allumer a leur place: la fiche d'un profil et l'import sont des
 * prolongements de la liste des profils.
 */
export const NAV_PARENT: Partial<Record<Screen, Screen>> = {
	profile: "versions",
	import: "versions",
};

export type NavItem = {
	screen: Screen;
	icon: LucideIcon;
	label: string;
	/** Affiche « a venir » a la place du compteur. */
	upcoming?: boolean;
};

export const PRIMARY_NAV: NavItem[] = [
	{ screen: "home", icon: Home, label: "Accueil" },
	{ screen: "versions", icon: Layers, label: "Profils" },
	{ screen: "mods", icon: Puzzle, label: "Mods" },
	{ screen: "cosmetics", icon: Shirt, label: "Cosmétiques", upcoming: true },
	{ screen: "shop", icon: Store, label: "Boutique", upcoming: true },
	{ screen: "accounts", icon: UserCircle, label: "Comptes" },
];

/**
 * Le groupe du bas: ce qu'on ouvre quand quelque chose ne va pas.
 *
 * <p>Les journaux ne figurent pas dans la maquette, qui n'en prevoit aucune
 * porte. Ils sont pourtant la seule facon de voir pourquoi un lancement a
 * echoue, et les supprimer aurait retire une fonction reelle pour respecter un
 * dessin. Ils rejoignent donc les parametres, dont ils partagent le role.
 */
export const SECONDARY_NAV: NavItem[] = [
	{ screen: "settings", icon: SlidersHorizontal, label: "Paramètres" },
	{ screen: "logs", icon: Terminal, label: "Journaux" },
];

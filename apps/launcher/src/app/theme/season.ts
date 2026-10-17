/**
 * Les thèmes du launcher, et la date qui en choisit un.
 *
 * <p>Tout est ici et rien n'est dans React: ce module ne connaît ni le DOM ni
 * les composants, il ne sait que répondre « quel thème, à quelle date ». C'est
 * ce qui permet de l'éprouver en passant une date au lieu d'attendre le mois
 * d'octobre pour voir si la bascule marche.
 */

/** Un thème réellement dessiné, par opposition à la préférence « auto ». */
export type ThemeId = "nocturne" | "halloween";

/**
 * Ce que le joueur a choisi dans les paramètres.
 *
 * <p>« auto » n'est pas un thème: c'est l'absence de choix, et c'est le défaut.
 * Garder les trois valeurs dans un seul champ plutôt qu'un booléen « suivre la
 * saison » plus un thème évite l'état impossible — « ne pas suivre la saison »
 * sans dire quoi afficher à la place.
 */
export type ThemePreference = "auto" | ThemeId;

export const THEME_PREFERENCES: ThemePreference[] = [
  "auto",
  "nocturne",
  "halloween",
];

/** Minuit local du jour de cette date, pour comparer des jours et non des instants. */
function minuit(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Jours restants avant le 31 octobre de l'année en cours.
 *
 * <p>Négatif une fois la date passée, zéro le jour même.
 *
 * <p>L'arrondi n'est pas une coquetterie, et le cas qui l'impose n'est pas
 * celui qu'on croit. En Europe, octobre recule l'heure: la journée fait
 * vingt-cinq heures, le quotient dépasse l'entier, et un {@code Math.floor}
 * tomberait juste par chance. Dans l'hémisphère sud, octobre l'avance — l'heure
 * d'été commence le premier dimanche du mois en Australie — la journée fait
 * vingt-trois heures, le quotient passe <em>sous</em> l'entier, et le même
 * {@code Math.floor} annonce « dans 29 jours » le 1er octobre au lieu de 30.
 * C'est-à-dire précisément le jour où le compte à rebours s'affiche pour la
 * première fois.
 */
export function joursAvantHalloween(maintenant: Date = new Date()): number {
  const depart = minuit(maintenant).getTime();
  const halloween = new Date(maintenant.getFullYear(), 9, 31).getTime();
  return Math.round((halloween - depart) / 86_400_000);
}

/**
 * Le thème que la date impose.
 *
 * <p>La fenêtre couvre tout octobre et les deux premiers jours de novembre.
 * Elle commence large pour que la décoration serve à quelque chose — un thème
 * qui n'apparaît que le 31 au soir, personne ne le voit — et elle déborde de
 * deux jours parce que la soirée du 31 se finit le 1er, et qu'un launcher qui
 * redevient violet pendant que les joueurs sont encore sur l'event a l'air
 * cassé plutôt que ponctuel.
 */
export function themeSaisonnier(maintenant: Date = new Date()): ThemeId {
  const mois = maintenant.getMonth();
  const jour = maintenant.getDate();

  if (mois === 9) return "halloween";
  if (mois === 10 && jour <= 2) return "halloween";
  return "nocturne";
}

/** Le thème à appliquer, préférence du joueur comprise. */
export function resoudreTheme(
  preference: ThemePreference,
  maintenant: Date = new Date(),
): ThemeId {
  return preference === "auto" ? themeSaisonnier(maintenant) : preference;
}

/**
 * Ce que le bandeau de saison annonce, ou null s'il n'y a rien à annoncer.
 *
 * <p>Le compte à rebours disparaît une fois le 31 passé au lieu de compter à
 * l'envers: « Il y a 1 jour » n'est une information pour personne, alors que le
 * thème, lui, a encore deux jours à vivre.
 *
 * <p>Il disparaît aussi quand le thème vient d'un choix manuel hors saison:
 * annoncer « dans 237 jours » à qui a simplement voulu l'ambiance orange en
 * mars serait un compte à rebours vers rien.
 */
export function bandeauSaison(
  theme: ThemeId,
  maintenant: Date = new Date(),
): { libelle: string; compte: string | null } | null {
  if (theme !== "halloween") return null;

  const horsSaison = themeSaisonnier(maintenant) !== "halloween";
  if (horsSaison) {
    return { libelle: "Halloween", compte: null };
  }

  const jours = joursAvantHalloween(maintenant);
  if (jours > 1) return { libelle: "Halloween", compte: `Dans ${jours} jours` };
  if (jours === 1) return { libelle: "Halloween", compte: "Demain" };
  if (jours === 0) return { libelle: "Halloween", compte: "Ce soir" };
  return { libelle: "Halloween", compte: null };
}

/** Millisecondes jusqu'au prochain minuit local. */
export function msAvantMinuit(maintenant: Date = new Date()): number {
  const demain = new Date(
    maintenant.getFullYear(),
    maintenant.getMonth(),
    maintenant.getDate() + 1,
  );
  return demain.getTime() - maintenant.getTime();
}

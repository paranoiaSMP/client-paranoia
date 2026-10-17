// Eprouve la bascule saisonniere du theme.
//
// Ce module ne fait que des calculs de date, et c'est precisement ce qui le
// rend facile a casser sans le voir: le defaut ne se manifeste qu'un jour
// precis de l'annee, et il n'y a pas de bouton pour le reproduire. Un banc qui
// lui passe des dates choisies verifie en une seconde ce qu'il faudrait sinon
// attendre douze mois pour constater.
//
// Le piege principal est le changement d'heure. Il tombe le dernier dimanche
// d'octobre, donc en plein dans la fenetre d'Halloween, et ce jour-la dure
// vingt-cinq heures. Une division entiere du nombre de millisecondes donne
// alors un jour de trop pendant toute la derniere semaine -- celle ou le
// compte a rebours est justement regarde.
//
// Usage: pnpm exec tsx scripts/test-season.ts

import {
  bandeauSaison,
  joursAvantHalloween,
  resoudreTheme,
  themeSaisonnier,
} from "../src/app/theme/season";

let echecs = 0;

function verifie(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ok    ${message}`);
    return;
  }
  echecs += 1;
  console.error(`  ECHEC ${message}`);
}

/** Midi local, pour ne pas eprouver la bascule et un bord de journee a la fois. */
function le(mois: number, jour: number, annee = 2026): Date {
  return new Date(annee, mois - 1, jour, 12, 0, 0);
}

/**
 * Execute un bloc dans un fuseau donne.
 *
 * <p>Sans cela le banc rendrait un resultat different selon la machine qui le
 * lance, et le cas qui compte -- l'heure d'ete australienne -- ne serait jamais
 * eprouve par une CI qui tourne en UTC.
 */
function sous(fuseau: string, bloc: () => void): void {
  const precedent = process.env.TZ;
  process.env.TZ = fuseau;
  try {
    bloc();
  } finally {
    if (precedent === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = precedent;
    }
  }
}

console.log("--- la fenetre d'Halloween");
{
  verifie(themeSaisonnier(le(9, 30)) === "nocturne", "le 30 septembre: encore Nocturne");
  verifie(themeSaisonnier(le(10, 1)) === "halloween", "le 1er octobre: la fenetre s'ouvre");
  verifie(themeSaisonnier(le(10, 31)) === "halloween", "le 31 octobre");
  verifie(
    themeSaisonnier(le(11, 2)) === "halloween",
    "le 2 novembre: la soiree du 31 a le droit de deborder",
  );
  verifie(themeSaisonnier(le(11, 3)) === "nocturne", "le 3 novembre: retour a Nocturne");
  verifie(themeSaisonnier(le(6, 15)) === "nocturne", "un jour de juin quelconque");
}

console.log("\n--- le compte a rebours, a Paris");
{
  sous("Europe/Paris", () => {
    verifie(joursAvantHalloween(le(10, 17)) === 14, "le 17 octobre: dans 14 jours");
    verifie(joursAvantHalloween(le(10, 30)) === 1, "la veille");
    verifie(joursAvantHalloween(le(10, 31)) === 0, "le jour meme");
    verifie(joursAvantHalloween(le(11, 1)) === -1, "le lendemain: negatif");
  });
}

console.log("\n--- le compte a rebours, a Sydney");
{
  // Le seul cas qui separe reellement une implementation juste d'une
  // implementation naive. En Europe, octobre RECULE l'heure: la journee fait
  // vingt-cinq heures, le quotient depasse l'entier, et un Math.floor tombe
  // juste par chance. En Australie, octobre l'AVANCE -- l'heure d'ete commence
  // le premier dimanche du mois -- la journee fait vingt-trois heures, le
  // quotient passe sous l'entier, et le meme Math.floor retire un jour.
  //
  // Verifie: au 1er octobre 2026 a Sydney, le quotient brut vaut 29,9583.
  // L'arrondi rend 30, le plancher rendrait 29.
  sous("Australia/Sydney", () => {
    verifie(
      joursAvantHalloween(le(10, 1)) === 30,
      "le 1er octobre: dans 30 jours, et non 29 -- l'heure d'ete australienne mange une heure",
    );
    verifie(joursAvantHalloween(le(10, 4)) === 27, "le 4 octobre: dans 27 jours");
    verifie(joursAvantHalloween(le(10, 17)) === 14, "le 17 octobre, apres la bascule");
    verifie(joursAvantHalloween(le(10, 31)) === 0, "le jour meme");
  });
}

console.log("\n--- ce que le bandeau annonce");
{
  verifie(bandeauSaison("nocturne", le(10, 17)) === null, "rien a annoncer sous Nocturne");

  const loin = bandeauSaison("halloween", le(10, 17));
  verifie(loin?.compte === "Dans 14 jours", "a deux semaines: le nombre de jours");

  verifie(bandeauSaison("halloween", le(10, 30))?.compte === "Demain", "la veille: « Demain »");
  verifie(bandeauSaison("halloween", le(10, 31))?.compte === "Ce soir", "le jour meme: « Ce soir »");

  verifie(
    bandeauSaison("halloween", le(11, 1))?.compte === null,
    "le 1er novembre: le theme reste, le compte a rebours disparait plutot que de compter a l'envers",
  );

  const force = bandeauSaison("halloween", le(6, 15));
  verifie(
    force !== null && force.compte === null,
    "theme force en juin: on nomme la saison sans annoncer « dans 138 jours »",
  );
}

console.log("\n--- la preference du joueur passe avant la date");
{
  verifie(resoudreTheme("auto", le(10, 17)) === "halloween", "auto en octobre");
  verifie(resoudreTheme("auto", le(6, 15)) === "nocturne", "auto en juin");
  verifie(
    resoudreTheme("nocturne", le(10, 31)) === "nocturne",
    "Nocturne force le 31 octobre: celui que la decoration derange la coupe",
  );
  verifie(
    resoudreTheme("halloween", le(6, 15)) === "halloween",
    "Halloween force en juin: celui qui la veut la garde",
  );
}

console.log(
  echecs === 0 ? "\nTout est vert." : `\n${echecs} verification(s) en echec.`,
);
process.exit(echecs === 0 ? 0 : 1);

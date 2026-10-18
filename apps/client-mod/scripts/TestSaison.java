// Eprouve la bascule saisonniere de l'ecran d'accueil.
//
// Ce banc existe parce que Saison est la seule partie de l'ecran qui contienne
// une decision plutot qu'un dessin, et parce qu'elle ne depend de rien: ni de
// Minecraft, ni de Fabric, ni du reste du mod. Elle se compile donc seule, ici,
// la ou le mod entier ne le peut pas -- les depots Fabric et Mojang sont
// refuses par la politique reseau de cet environnement, et la CI est le seul
// endroit qui compile le reste.
//
// Le defaut qu'il attrape ne se manifeste qu'un jour precis de l'annee, et il
// n'y a pas de bouton pour le reproduire. Lui passer des dates choisies verifie
// en une seconde ce qu'il faudrait sinon attendre douze mois pour constater.
//
// Usage, depuis apps/client-mod:
//   javac -d /tmp/saison src/main/java/gg/paranoia/client/title/Saison.java \
//         scripts/TestSaison.java && java -cp /tmp/saison TestSaison

import gg.paranoia.client.title.Saison;

import java.time.LocalDate;

public final class TestSaison {
    private static int echecs;

    private static void verifie(boolean condition, String message) {
        if (condition) {
            System.out.println("  ok    " + message);
            return;
        }
        echecs++;
        System.out.println("  ECHEC " + message);
    }

    private static LocalDate le(int mois, int jour) {
        return LocalDate.of(2026, mois, jour);
    }

    public static void main(String[] args) {
        System.out.println("--- la fenetre d'Halloween");
        verifie(!Saison.estLaSaison(le(9, 30)), "le 30 septembre: pas encore");
        verifie(Saison.estLaSaison(le(10, 1)), "le 1er octobre: la fenetre s'ouvre");
        verifie(Saison.estLaSaison(le(10, 31)), "le 31 octobre");
        verifie(Saison.estLaSaison(le(11, 2)),
            "le 2 novembre: la soiree du 31 a le droit de deborder");
        verifie(!Saison.estLaSaison(le(11, 3)), "le 3 novembre: termine");
        verifie(!Saison.estLaSaison(le(6, 15)), "un jour de juin quelconque");

        System.out.println();
        System.out.println("--- le compte a rebours");
        verifie(Saison.joursAvantHalloween(le(10, 1)) == 30, "le 1er octobre: dans 30 jours");
        verifie(Saison.joursAvantHalloween(le(10, 18)) == 13, "le 18 octobre: dans 13 jours");
        verifie(Saison.joursAvantHalloween(le(10, 30)) == 1, "la veille");
        verifie(Saison.joursAvantHalloween(le(10, 31)) == 0, "le jour meme");
        verifie(Saison.joursAvantHalloween(le(11, 1)) == -1, "le lendemain: negatif");

        // Le cas qui coutait un arrondi au launcher. Il compte des
        // millisecondes, donc le changement d'heure d'octobre -- vingt-trois
        // heures dans l'hemisphere sud, vingt-cinq dans le notre -- fait passer
        // le quotient de part et d'autre de l'entier. Ici le compte porte sur
        // des dates de calendrier: le fuseau de la machine ne doit rien y
        // changer, et c'est ce qu'on verifie plutot que de le supposer.
        System.out.println();
        System.out.println("--- le fuseau ne doit rien changer");
        String[] fuseaux = {"UTC", "Europe/Paris", "Australia/Sydney", "Pacific/Kiritimati"};
        for (String fuseau : fuseaux) {
            System.setProperty("user.timezone", fuseau);
            java.util.TimeZone.setDefault(java.util.TimeZone.getTimeZone(fuseau));
            verifie(Saison.joursAvantHalloween(le(10, 1)) == 30,
                "sous " + fuseau + ": toujours 30 jours au 1er octobre");
        }

        System.out.println();
        System.out.println("--- ce que le bandeau annonce");
        verifie("HALLOWEEN DANS 13 JOURS".equals(Saison.bandeau(le(10, 18))),
            "a deux semaines: le nombre de jours");
        verifie("HALLOWEEN, DEMAIN".equals(Saison.bandeau(le(10, 30))), "la veille");
        verifie("HALLOWEEN, CE SOIR".equals(Saison.bandeau(le(10, 31))), "le jour meme");
        verifie("HALLOWEEN".equals(Saison.bandeau(le(11, 1))),
            "le 1er novembre: la saison reste, le compte a rebours disparait"
                + " plutot que de compter a l'envers");
        verifie("HALLOWEEN".equals(Saison.bandeau(le(6, 15))),
            "saison forcee en juin: on nomme la saison sans annoncer « dans 138 jours »");

        System.out.println();
        System.out.println("--- la preference du joueur passe avant la date");
        verifie(Saison.AUTO.resolue(le(10, 18)) == Saison.HALLOWEEN, "auto en octobre");
        verifie(Saison.AUTO.resolue(le(6, 15)) == Saison.AUCUNE, "auto en juin");
        verifie(Saison.AUCUNE.resolue(le(10, 31)) == Saison.AUCUNE,
            "coupee le 31 octobre: celui que la decoration derange la coupe");
        verifie(Saison.HALLOWEEN.resolue(le(6, 15)) == Saison.HALLOWEEN,
            "forcee en juin: celui qui la veut la garde");
        verifie(Saison.AUTO.resolue(le(10, 18)) != Saison.AUTO
                && Saison.AUTO.resolue(le(6, 15)) != Saison.AUTO,
            "resolue ne rend jamais AUTO: le dessin n'a que deux cas a traiter");

        System.out.println();
        System.out.println(echecs == 0 ? "Tout est vert." : echecs + " verification(s) en echec.");
        System.exit(echecs == 0 ? 0 : 1);
    }
}

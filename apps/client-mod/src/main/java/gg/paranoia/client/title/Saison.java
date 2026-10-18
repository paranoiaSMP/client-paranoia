package gg.paranoia.client.title;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * La saison de l'ecran d'accueil, et la date qui en choisit une.
 *
 * <p>Rien ici ne connait Minecraft: ni DrawContext, ni Identifier, ni meme le
 * reste du mod. C'est deliberé, et c'est ce qui permet d'eprouver la bascule en
 * lui passant une date au lieu d'attendre le mois d'octobre pour savoir si elle
 * marche -- l'environnement de developpement n'a pas de quoi compiler le mod
 * entier, mais il a de quoi compiler ce fichier seul.
 *
 * <p>Meme fenetre que le launcher, et pour les memes raisons: tout octobre plus
 * les deux premiers jours de novembre. Elle commence large parce qu'une
 * decoration qui n'apparait que le 31 au soir, personne ne la voit; elle
 * deborde de deux jours parce que la soiree du 31 se finit le 1er, et qu'un
 * ecran qui redevient violet pendant que les joueurs sont encore dessus a
 * l'air casse plutot que ponctuel.
 */
public enum Saison {
    /** Pas de saison: la gamme Nocturne, toute l'annee. */
    AUCUNE("Aucune"),
    HALLOWEEN("Halloween"),
    /** Laisser la date decider. C'est le defaut, et ce n'est pas une saison. */
    AUTO("Automatique");

    private final String label;

    Saison(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }

    /**
     * La saison reellement dessinee, preference du joueur comprise.
     *
     * <p>Ne rend jamais {@link #AUTO}: « automatique » est l'absence de choix,
     * pas une troisieme apparence. Tout ce qui dessine appelle ceci et n'a donc
     * que deux cas a traiter.
     */
    public Saison resolue(LocalDate jour) {
        if (this != AUTO) {
            return this;
        }
        return estLaSaison(jour) ? HALLOWEEN : AUCUNE;
    }

    /** La date tombe-t-elle dans la fenetre d'Halloween ? */
    public static boolean estLaSaison(LocalDate jour) {
        int mois = jour.getMonthValue();
        return mois == 10 || (mois == 11 && jour.getDayOfMonth() <= 2);
    }

    /**
     * Jours restants avant le 31 octobre de l'annee en cours.
     *
     * <p>Negatif une fois la date passee, zero le jour meme.
     *
     * <p>Le compte se fait sur des dates et non sur des millisecondes, ce qui
     * n'est pas un detail de style. Le launcher, lui, soustrait deux instants
     * et divise par la duree d'un jour; il doit arrondir, parce qu'octobre
     * porte le changement d'heure et qu'une journee y fait vingt-trois ou
     * vingt-cinq heures selon l'hemisphere. {@link ChronoUnit#DAYS} entre deux
     * {@link LocalDate} compte des jours de calendrier: le probleme ne se pose
     * pas, et il n'y a donc pas d'arrondi a oublier.
     */
    public static int joursAvantHalloween(LocalDate jour) {
        return (int) ChronoUnit.DAYS.between(jour, LocalDate.of(jour.getYear(), 10, 31));
    }

    /**
     * Ce que le bandeau annonce, ou {@code null} s'il n'y a rien a annoncer.
     *
     * <p>Le compte a rebours disparait une fois le 31 passe au lieu de compter
     * a l'envers: « il y a 1 jour » n'est une information pour personne, alors
     * que la saison, elle, a encore deux jours a vivre.
     *
     * <p>Hors saison il ne reste que le nom. Annoncer « dans 237 jours » a qui
     * a simplement voulu l'ambiance orange en mars serait un compte a rebours
     * vers rien.
     */
    public static String bandeau(LocalDate jour) {
        if (!estLaSaison(jour)) {
            return "HALLOWEEN";
        }

        int jours = joursAvantHalloween(jour);
        if (jours > 1) {
            return "HALLOWEEN DANS " + jours + " JOURS";
        }
        if (jours == 1) {
            return "HALLOWEEN, DEMAIN";
        }
        if (jours == 0) {
            return "HALLOWEEN, CE SOIR";
        }
        return "HALLOWEEN";
    }
}

package gg.paranoia.client.title;

import gg.paranoia.client.platform.Platforms;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.Identifier;

/**
 * Les decorations de saison, posees autour de l'ecran d'accueil.
 *
 * <p>Des textures et non des rectangles, contrairement au reste du menu: une
 * toile d'araignee ou une chauve-souris faites de {@code fill} demanderaient
 * cent appels pour un resultat approximatif, alors que le dessin d'une texture
 * passe deja par la plateforme -- c'est le chemin du logo, celui dont on sait
 * qu'il marche.
 *
 * <p>Les fichiers sont du pixel art a leur resolution d'affichage, et chacun
 * est dessine a un <em>multiple entier</em> de sa taille. C'est la seule regle
 * qui compte ici: le jeu echantillonne au plus proche voisin, donc un facteur
 * fractionnaire garderait deux rangees de texels sur trois et en doublerait une
 * -- le trait cesserait d'etre regulier, et un dessin dont toute l'allure tient
 * a la regularite de ses pixels se mettrait a baver. La premiere version
 * dessinait a 68, 26, 20: aucune de ces tailles n'etait un multiple de la
 * source.
 *
 * <p>Toute erreur de dessin est avalee. Une decoration est ce qu'il y a de plus
 * accessoire sur cet ecran, et le pire echec imaginable ici est un plantage de
 * l'ecran-titre -- c'est-a-dire un jeu qui ne demarre plus du tout.
 */
public final class Decor {
    /**
     * L'orange de la saison, repris tel quel du launcher.
     *
     * <p>La valeur vient de {@code styles.css}, comme toute la gamme Nocturne.
     * C'est le seul moyen que les deux moities du client restent d'accord: les
     * rapprocher a l'oeil, c'est reconduire sous une autre forme la derive que
     * la verification de palette existe pour empecher.
     */
    public static final int ORANGE = 0xFFED8725;

    /**
     * Le trait du rail, en saison.
     *
     * <p>Couleur et opacite relevees dans le dessin fourni -- {@code #FC8731} a
     * mi-opacite -- et non choisies a cote de lui.
     */
    public static final int RAIL_SAISON = 0x80FC8731;

    /** Les dessins sont deja colores: rien a teinter. */
    private static final int TEL_QUEL = 0xFFFFFFFF;

    private static final Identifier TOILE = decor("toile");
    private static final Identifier LUNE = decor("lune");
    private static final Identifier CITROUILLE = decor("citrouille");
    private static final Identifier RAIL_PIED = decor("rail-pied");
    private static final Identifier[] CHAUVE_SOURIS = {
        decor("chauve-souris-1"), decor("chauve-souris-2"),
    };

    /* Tailles des fichiers, en texels. */
    private static final int CARRE_32 = 32;
    private static final int CARRE_16 = 16;
    private static final int BAT_L = 16;
    private static final int BAT_H = 8;
    private static final int PIED_L = 14;
    private static final int PIED_H = 8;

    /** Un tour complet de la traversee, en millisecondes. */
    private static final long TRAVERSEE = 48_000L;
    /** Duree d'une etape du battement d'ailes. */
    private static final long BATTEMENT = 160L;

    private Decor() {
    }

    private static Identifier decor(String nom) {
        return Identifier.of("paranoia_client", "textures/gui/title/decor/" + nom + ".png");
    }

    /**
     * Ce qui se pose derriere l'interface: la toile, la lune, les
     * chauves-souris.
     *
     * <p>Derriere, et non devant: ce sont des elements de ciel. Une
     * chauve-souris qui passerait par-dessus le pseudonyme ou les titres les
     * rendrait illisibles une seconde sur trois, pour rien.
     */
    public static void arriere(DrawContext context, int width, int height) {
        pose(context, TOILE, 0, 0, 64, 64, CARRE_32, CARRE_32, TEL_QUEL);

        // La lune est posee sous le bandeau de saison et non a sa hauteur: les
        // deux tirent vers le coin haut droit, et le texte doit rester lisible.
        pose(context, LUNE, width - 150, 46, 64, 64, CARRE_32, CARRE_32, TEL_QUEL);

        // Trois traversees desynchronisees, a deux tailles. A l'unisson elles
        // feraient un logo, pas un vol.
        chauveSouris(context, width, 0L, 58, 2);
        chauveSouris(context, width, 17_000L, 96, 1);
        chauveSouris(context, width, 31_000L, 140, 1);
    }

    /**
     * Ce qui se pose devant: les citrouilles du coin bas droit.
     *
     * <p>Devant, parce qu'elles sont posees au sol de l'ecran et non dans son
     * ciel, et parce que rien ne passe la: la mention legale est une ligne plus
     * bas, la barre d'outils est a l'autre bout.
     */
    public static void avant(DrawContext context, int width, int height) {
        pose(context, CITROUILLE, width - 64, height - 46, 32, 32, CARRE_16, CARRE_16, TEL_QUEL);
        pose(context, CITROUILLE, width - 28, height - 30, 16, 16, CARRE_16, CARRE_16, TEL_QUEL);
    }

    /**
     * Le pied du rail: le petit carre creux et son ergot.
     *
     * @param x colonne du trait. Le dessin entre par sa troisieme colonne, d'ou
     *     le recul: cale sur son bord, le carre serait decentre du trait.
     */
    public static void railPied(DrawContext context, int x, int y) {
        pose(context, RAIL_PIED, x - 2, y, PIED_L, PIED_H, PIED_L, PIED_H, TEL_QUEL);
    }

    /**
     * Une chauve-souris qui traverse l'ecran, ailes battantes.
     *
     * <p>Le temps absolu, et non un compteur d'images: la traversee garde la
     * meme duree et le battement la meme cadence quel que soit le nombre
     * d'images par seconde, comme la bande qui defile en fond.
     *
     * <p>Le battement est decale par la position de la bestiole et pas seulement
     * par son retard de depart. Deux chauves-souris parties a des moments
     * differents mais a la meme cadence finissent sinon par battre ensemble, et
     * le vol redevient un metronome.
     */
    private static void chauveSouris(
        DrawContext context, int width, long decalage, int hauteur, int facteur) {
        long maintenant = System.currentTimeMillis();
        long temps = (maintenant + decalage) % TRAVERSEE;

        int larg = BAT_L * facteur;
        int haut = BAT_H * facteur;

        // La course part d'une largeur hors de l'ecran et y finit: la bestiole
        // entre et sort au lieu d'apparaitre et de disparaitre sur place.
        int course = width + larg * 2;
        int x = (int) (temps * course / TRAVERSEE) - larg;

        // Un leger roulis vertical. Sans lui le vol est un glissement.
        double phase = temps * 2 * Math.PI / 6_000.0;
        int y = hauteur + (int) Math.round(Math.sin(phase) * 5);

        int etape = (int) (((maintenant + decalage) / BATTEMENT + x) % CHAUVE_SOURIS.length);
        pose(context, CHAUVE_SOURIS[etape], x, y, larg, haut, BAT_L, BAT_H, TEL_QUEL);
    }

    private static void pose(
        DrawContext context, Identifier texture,
        int x, int y, int larg, int haut, int texLarg, int texHaut, int teinte) {
        try {
            Platforms.get().drawTexture(
                context, texture, x, y, larg, haut, texLarg, texHaut, teinte);
        } catch (RuntimeException echec) {
            // Silencieux, et c'est le seul endroit du mod ou ca se defend: la
            // texture peut ne pas encore exister a la premiere image, le cas se
            // reglera de lui-meme a la suivante, et il n'y a rien que le joueur
            // puisse faire d'un avertissement sur une citrouille.
        }
    }
}

package gg.paranoia.client.title;

import gg.paranoia.client.menu.MenuTheme;
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
 * <p>Les fichiers font le double de leur taille a l'ecran, comme le logo et les
 * icones: l'echantillonnage du jeu se fait au plus proche voisin, et deux
 * texels pour deux pixels gardent le trait net a l'echelle d'interface 2.
 *
 * <p>Toute erreur de dessin est avalee. Une decoration est ce qu'il y a de plus
 * accessoire sur cet ecran, et le pire echec imaginable ici est un plantage de
 * l'ecran-titre -- c'est-a-dire un jeu qui ne demarre plus du tout.
 */
public final class Decor {
    /**
     * L'orange de la saison, repris tel quel du launcher.
     *
     * <p>La valeur vient de {@code styles.css}, comme toute la gamme Nocturne
     * que porte {@link MenuTheme}. C'est le seul moyen que les deux moities du
     * client restent d'accord: les rapprocher a l'oeil, c'est reconduire sous
     * une autre forme la derive que cette regle existe pour empecher.
     */
    public static final int ORANGE = 0xFFED8725;

    /** La toile est un trait, pas une masse: elle se pose a peine sur le ciel. */
    private static final int ENCRE_TOILE = 0x88E9E9ED;
    /** Les chauves-souris passent devant la lune, donc en silhouette. */
    private static final int ENCRE_CHAUVE_SOURIS = 0xDD161826;

    private static final Identifier TOILE = decor("toile");
    private static final Identifier LUNE = decor("lune");
    private static final Identifier CHAUVE_SOURIS = decor("chauve-souris");
    private static final Identifier CITROUILLE = decor("citrouille");

    /** Un tour complet de la traversee, en millisecondes. */
    private static final long TRAVERSEE = 48_000L;

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
        pose(context, TOILE, 0, 0, 68, 68, 128, 128, ENCRE_TOILE);

        // La lune est posee sous le bandeau de saison et non a sa hauteur: les
        // deux tirent vers le coin haut-droit, et le texte doit rester lisible.
        pose(context, LUNE, width - 142, 46, 48, 48, 128, 128, 0xFFFFFFFF);

        // Trois traversees desynchronisees. A l'unisson elles feraient un logo,
        // pas un vol; les tailles differentes suffisent a suggerer la distance.
        chauveSouris(context, width, 0L, 58, 34, 16);
        chauveSouris(context, width, 17_000L, 96, 26, 12);
        chauveSouris(context, width, 31_000L, 140, 20, 9);
    }

    /**
     * Ce qui se pose devant: les citrouilles du coin bas-droit.
     *
     * <p>Devant, parce qu'elles sont posees au sol de l'ecran et non dans son
     * ciel, et parce que rien ne passe la: le pied de page est une ligne plus
     * bas, la barre d'outils est a l'autre bout.
     */
    public static void avant(DrawContext context, int width, int height) {
        pose(context, CITROUILLE, width - 58, height - 40, 26, 26, 64, 64, 0xFFFFFFFF);
        pose(context, CITROUILLE, width - 34, height - 34, 20, 20, 64, 64, 0xFFFFFFFF);
    }

    /**
     * Une chauve-souris qui traverse l'ecran.
     *
     * <p>Le temps absolu, et non un compteur d'images: la traversee garde la
     * meme duree quel que soit le nombre d'images par seconde, comme la bande
     * qui defile en fond.
     */
    private static void chauveSouris(
        DrawContext context, int width, long decalage, int hauteur, int larg, int haut) {
        long temps = (System.currentTimeMillis() + decalage) % TRAVERSEE;

        // La course part d'une largeur hors de l'ecran et y finit: la bestiole
        // entre et sort au lieu d'apparaitre et de disparaitre sur place.
        int course = width + larg * 2;
        int x = (int) (temps * course / TRAVERSEE) - larg;

        // Un leger roulis vertical. Sans lui le vol est un glissement.
        double phase = temps * 2 * Math.PI / 6_000.0;
        int y = hauteur + (int) Math.round(Math.sin(phase) * 5);

        pose(context, CHAUVE_SOURIS, x, y, larg, haut, 96, 44, ENCRE_CHAUVE_SOURIS);
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

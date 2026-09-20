package gg.paranoia.client.render;

import net.minecraft.client.gui.DrawContext;

/**
 * Rectangles a coins ronds, dessines en escalier.
 *
 * <p>{@code DrawContext} ne connait que {@code fill}: un rectangle aligne sur
 * les axes, sans rayon ni antialiasing. Un coin rond se compose donc a la main,
 * une rangee de pixels a la fois -- ce qui tombe bien, c'est exactement
 * l'esthetique du jeu.
 *
 * <p>Ce qui existait avant ici tenait en trois rectangles et rongeait un seul
 * pixel a chaque coin. Ca ne se voit pas: la maquette demande huit pixels de
 * rayon sur une scene large de 1600, soit cinq dans l'espace de coordonnees du
 * jeu, et un carre dont on a gratte un pixel reste un carre a l'oeil.
 *
 * <p>Le cout est negligeable: un rayon de cinq demande onze {@code fill} au lieu
 * d'un, et le jeu les regroupe dans le meme lot de quads.
 */
public final class Shapes {
    /**
     * Au-dela, un coin rond avale la boite entiere.
     *
     * <p>Les HUD du jeu mesurent quinze pixels de haut pour une ligne de texte:
     * {@link #fitRadius} borne de toute facon le rayon a la moitie du plus petit
     * cote, cette limite ne sert qu'a garder la table courte.
     */
    private static final int MAX_RADIUS = 12;

    /**
     * Le retrait horizontal de chaque rangee d'un quart d'arc, precalcule.
     *
     * <p>{@code INSETS[r][j]} est le nombre de pixels a retirer du bord pour la
     * rangee {@code j} d'un coin de rayon {@code r}. Le calcul est celui du
     * cercle: la demi-corde a la hauteur de la rangee, prise en son milieu --
     * d'ou le {@code 0.5}, sans lequel l'arc est decale d'un demi-pixel et le
     * coin parait coupe en biais plutot que rond.
     */
    private static final int[][] INSETS = new int[MAX_RADIUS + 1][];

    static {
        for (int r = 0; r <= MAX_RADIUS; r++) {
            int[] rows = new int[r];
            for (int j = 0; j < r; j++) {
                double dy = r - j - 0.5;
                rows[j] = (int) Math.round(r - Math.sqrt((double) r * r - dy * dy));
            }
            INSETS[r] = rows;
        }
    }

    private Shapes() {
    }

    /** Le rayon reellement dessinable dans une boite de cette taille. */
    public static int fitRadius(int radius, int width, int height) {
        int limit = Math.min(width, height) / 2;
        return Math.max(0, Math.min(Math.min(radius, MAX_RADIUS), limit));
    }

    /** Le retrait de la rangee du haut: ou commencer une arete posee sur le bord. */
    public static int topInset(int radius, int width, int height) {
        int r = fitRadius(radius, width, height);
        return r == 0 ? 0 : INSETS[r][0];
    }

    /** Rectangle plein a coins ronds. Un rayon nul rend un simple rectangle. */
    public static void rounded(
        DrawContext context, int x, int y, int width, int height, int radius, int color) {
        rounded(context, x, y, width, height, radius, radius, color);
    }

    /**
     * Meme chose, mais les deux bords peuvent avoir des rayons differents.
     *
     * <p>Necessaire des qu'une zone est collee au bord d'un cadre arrondi:
     * l'en-tete du menu touche le haut de la fenetre et doit suivre ses deux
     * coins hauts, tandis que son bord bas est une simple separation droite. Un
     * rectangle carre a cet endroit laisse depasser ses angles hors du cadre.
     */
    public static void rounded(
        DrawContext context, int x, int y, int width, int height,
        int radiusTop, int radiusBottom, int color) {
        if (width <= 0 || height <= 0) {
            return;
        }

        int top = fitRadius(radiusTop, width, height);
        int bottom = fitRadius(radiusBottom, width, height);
        if (top == 0 && bottom == 0) {
            context.fill(x, y, x + width, y + height, color);
            return;
        }

        // Le corps pleine largeur entre les deux arcs, puis chaque rangee d'arc.
        context.fill(x, y + top, x + width, y + height - bottom, color);
        for (int j = 0; j < top; j++) {
            int inset = INSETS[top][j];
            context.fill(x + inset, y + j, x + width - inset, y + j + 1, color);
        }
        for (int j = 0; j < bottom; j++) {
            int inset = INSETS[bottom][j];
            context.fill(x + inset, y + height - 1 - j, x + width - inset, y + height - j, color);
        }
    }

    /**
     * Contour d'un pixel suivant les memes coins.
     *
     * <p>Dessine comme un anneau et non comme deux formes superposees: un fond
     * translucide pose par-dessus une forme pleine de la couleur du trait
     * teinterait tout l'interieur. C'est visible sur le style « Verre », dont le
     * liseré est blanc a 14 %.
     *
     * <p>Une rangee de l'anneau contient les pixels de son bord lateral, plus
     * ceux que la rangee du dessus ne couvre pas -- c'est ce debord qui dessine
     * la marche.
     */
    public static void roundedOutline(
        DrawContext context, int x, int y, int width, int height, int radius, int color) {
        if (width <= 0 || height <= 0) {
            return;
        }

        int r = fitRadius(radius, width, height);
        int[] rows = INSETS[r];

        for (int j = 0; j < height; j++) {
            int inset;
            int above;
            if (j < r) {
                inset = rows[j];
                // Premiere rangee: rien ne la couvre, elle est donc entierement
                // exposee -- d'ou une moitie de largeur, que la borne ci-dessous
                // ramene au trait continu du bord haut.
                above = j == 0 ? width : rows[j - 1];
            } else if (j >= height - r) {
                int k = height - 1 - j;
                inset = rows[k];
                above = k == 0 ? width : rows[k - 1];
            } else {
                inset = 0;
                above = 0;
            }

            int span = width - 2 * inset;
            int thickness = Math.max(above - inset, 1);
            if (2 * thickness >= span) {
                // Boite trop etroite pour deux segments distincts: un seul trait,
                // sinon les deux se chevauchent et la couleur se compose deux fois.
                context.fill(x + inset, y + j, x + width - inset, y + j + 1, color);
                continue;
            }
            context.fill(x + inset, y + j, x + inset + thickness, y + j + 1, color);
            context.fill(x + width - inset - thickness, y + j, x + width - inset, y + j + 1, color);
        }
    }
}

package gg.paranoia.client.menu;

import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

/**
 * Couleurs et primitives de dessin du menu.
 *
 * <p>Tout passe par {@code fill} et {@code drawText}: ce sont les deux seules
 * primitives dont la signature n'a pas bouge sur les versions ciblees. Les coins
 * arrondis, les contours et les icones sont donc composes de rectangles, ce qui
 * tombe bien -- c'est exactement l'esthetique du jeu.
 */
public final class MenuTheme {
    /*
     * La gamme Nocturne, celle du launcher, en ARGB.
     *
     * Le menu etait gris: l'ecart entre le canal bleu et le canal rouge y
     * valait 5 points sur le fond et 8 sur les cartes, contre 16 et 22 cote
     * launcher. En dessous de dix, l'oeil ne lit plus une teinte -- il lit du
     * gris. Les deux moities du client portaient donc le meme escalier de
     * clarte et deux couleurs differentes, sans que rien ne le signale.
     *
     * Les valeurs viennent telles quelles de styles.css: memes fonds, meme
     * accent, meme trait. C'est le seul moyen que les deux restent d'accord --
     * les rapprocher a l'oeil, c'est reconduire la derive sous une autre forme.
     */

    /** Assombrissement du jeu derriere la fenetre, par-dessus le flou. */
    public static final int BACKDROP = 0x99161826;

    public static final int WINDOW = 0xF2161826;
    public static final int WINDOW_BORDER = 0x29E9E9ED;
    public static final int HEADER = 0xFF232532;
    public static final int SIDEBAR = 0xFF232532;

    public static final int CARD = 0xFF232532;
    public static final int CARD_HOVER = 0xFF292B31;
    public static final int CARD_BORDER = 0x1FE9E9ED;

    /*
     * L'accent descend de #B07CFF a #9184D9, et ce n'est pas un adoucissement
     * arbitraire: #B07CFF est a un cheveu du cran 300 du launcher, celui qu'il
     * reserve a l'emphase. Le menu utilisait donc par defaut la couleur que
     * l'autre moitie garde pour attirer l'oeil, ce qui ne laissait plus rien
     * pour attirer l'oeil.
     */
    public static final int ACCENT = 0xFF9184D9;
    public static final int ACCENT_DIM = 0x559184D9;
    public static final int TEXT = 0xFFE9E9ED;
    public static final int TEXT_DIM = 0xFF9397AB;

    /*
     * Les etats gardent leurs couleurs: vert et rouge ne disent pas la marque,
     * ils disent allume et eteint. Les ramener sur la gamme effacerait
     * justement ce qu'ils signalent. Seul le verrouille rejoint les neutres --
     * il ne dit rien d'autre que « indisponible ».
     */
    public static final int STATE_ON = 0xFF3E9E5E;
    public static final int STATE_ON_HOVER = 0xFF49B76D;
    public static final int STATE_OFF = 0xFFC2404C;
    public static final int STATE_OFF_HOVER = 0xFFD44E5A;
    public static final int STATE_LOCKED = 0xFF595D6C;

    public static final int ROW_HOVER = 0x1AE9E9ED;
    public static final int GUIDE = 0xFF9184D9;

    private MenuTheme() {
    }

    public static boolean inside(double mouseX, double mouseY, int x, int y, int w, int h) {
        return mouseX >= x && mouseX < x + w && mouseY >= y && mouseY < y + h;
    }

    public static void outline(DrawContext context, int x, int y, int w, int h, int color) {
        context.fill(x, y, x + w, y + 1, color);
        context.fill(x, y + h - 1, x + w, y + h, color);
        context.fill(x, y + 1, x + 1, y + h - 1, color);
        context.fill(x + w - 1, y + 1, x + w, y + h - 1, color);
    }

    /**
     * Rectangle aux coins ronges d'un pixel.
     *
     * <p>Trois rectangles: le corps pleine largeur, puis les deux bords
     * lateraux rentres d'un pixel en haut et en bas. C'est tout ce qu'il faut
     * pour casser l'angle droit, et ca suffit a l'oeil a cette taille.
     */
    public static void panel(DrawContext context, int x, int y, int w, int h, int color) {
        context.fill(x + 1, y, x + w - 1, y + h, color);
        context.fill(x, y + 1, x + 1, y + h - 1, color);
        context.fill(x + w - 1, y + 1, x + w, y + h - 1, color);
    }

    public static void text(
        DrawContext context, TextRenderer font, String value, int x, int y, int color) {
        context.drawText(font, value, x, y, color, false);
    }

    /** Texte centre horizontalement dans une largeur donnee. */
    public static void centered(
        DrawContext context, TextRenderer font, String value, int x, int width, int y, int color) {
        context.drawText(font, value, x + (width - font.getWidth(value)) / 2, y, color, false);
    }

    /** Texte aligne a droite d'une largeur donnee. */
    public static void right(
        DrawContext context, TextRenderer font, String value, int x, int width, int y, int color) {
        context.drawText(font, value, x + width - font.getWidth(value), y, color, false);
    }

    /**
     * Tronque un texte trop long pour la largeur disponible.
     *
     * <p>Un nom de module qui deborde de sa carte passerait sous la carte
     * voisine: la police du jeu ne coupe rien toute seule.
     */
    public static String fit(TextRenderer font, String value, int maxWidth) {
        if (font.getWidth(value) <= maxWidth) {
            return value;
        }

        String truncated = value;
        while (!truncated.isEmpty() && font.getWidth(truncated + "...") > maxWidth) {
            truncated = truncated.substring(0, truncated.length() - 1);
        }
        return truncated + "...";
    }

    /** Pastille de filtre, comme les chips "ALL / HUD / SERVEUR" de la maquette. */
    public static void chip(
        DrawContext context, TextRenderer font, String label,
        int x, int y, int w, int h, boolean active, boolean hovered) {
        int background = active ? ACCENT_DIM : (hovered ? CARD_HOVER : CARD);
        panel(context, x, y, w, h, background);
        if (active) {
            outline(context, x, y, w, h, ACCENT);
        }
        centered(context, font, label, x, w, y + (h - font.fontHeight) / 2 + 1,
            active ? ACCENT : TEXT_DIM);
    }
}

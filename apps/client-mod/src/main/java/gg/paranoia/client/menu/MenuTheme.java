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
    /** Assombrissement du jeu derriere la fenetre, par-dessus le flou. */
    public static final int BACKDROP = 0x99000000;

    public static final int WINDOW = 0xF20E0E13;
    public static final int WINDOW_BORDER = 0x33FFFFFF;
    public static final int HEADER = 0xFF15151C;
    public static final int SIDEBAR = 0xFF101016;

    public static final int CARD = 0xFF191921;
    public static final int CARD_HOVER = 0xFF22222E;
    public static final int CARD_BORDER = 0x22FFFFFF;

    public static final int ACCENT = 0xFFB07CFF;
    public static final int ACCENT_DIM = 0x55B07CFF;
    public static final int TEXT = 0xFFE8E8F0;
    public static final int TEXT_DIM = 0xFF8A8A9A;

    /** Etats du bouton d'une carte, repris de la maquette. */
    public static final int STATE_ON = 0xFF3E9E5E;
    public static final int STATE_ON_HOVER = 0xFF49B76D;
    public static final int STATE_OFF = 0xFFC2404C;
    public static final int STATE_OFF_HOVER = 0xFFD44E5A;
    public static final int STATE_LOCKED = 0xFF4A4A56;

    public static final int ROW_HOVER = 0x22FFFFFF;
    public static final int GUIDE = 0xFFB07CFF;

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

package gg.paranoia.client.menu;

import gg.paranoia.client.render.Shapes;
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
     * L'etat d'un module se lisait a la couleur d'un bandeau, vert ou rouge.
     * Il se lit maintenant a la position d'une pastille, comme dans la maquette:
     * la couleur ne fait plus que confirmer, et elle peut donc rejoindre la
     * gamme. Le rouge reste pour ce qui est refuse, le neutre pour ce qui est
     * indisponible -- deux choses que l'accent ne saurait pas dire.
     */
    public static final int TRACK_ON = 0xE6796CBF;
    public static final int TRACK_OFF = 0xE63F424D;
    public static final int KNOB_ON = 0xFFF5F4FF;
    public static final int KNOB_OFF = 0xFF9397AB;
    public static final int STATE_OFF = 0xFFC2404C;
    public static final int STATE_LOCKED = 0xFF595D6C;

    public static final int ROW_HOVER = 0x1AE9E9ED;
    public static final int GUIDE = 0xFF9184D9;

    private MenuTheme() {
    }

    public static boolean inside(double mouseX, double mouseY, int x, int y, int w, int h) {
        return mouseX >= x && mouseX < x + w && mouseY >= y && mouseY < y + h;
    }

    /**
     * Rayon des cartes et des boutons du menu.
     *
     * <p>Quatre, la aussi par conversion d'echelle: la maquette dessine ses
     * cartes a huit pixels de rayon sur une scene large de 1600, et l'interface
     * du jeu en compte environ 960. Le cadre de la fenetre prend six, par
     * l'accesseur a rayon explicite.
     */
    public static final int RADIUS = 4;

    public static void outline(DrawContext context, int x, int y, int w, int h, int color) {
        outline(context, x, y, w, h, RADIUS, color);
    }

    public static void outline(
        DrawContext context, int x, int y, int w, int h, int radius, int color) {
        Shapes.roundedOutline(context, x, y, w, h, radius, color);
    }

    /**
     * Rectangle a coins ronds.
     *
     * <p>Rongeait auparavant un seul pixel a chaque coin, en trois rectangles.
     * Ca ne se voit pas: un carre dont on a gratte un pixel reste un carre a
     * l'oeil, et le menu paraissait donc carre a cote de sa maquette. Le rayon
     * est maintenant reellement dessine, une rangee de pixels a la fois.
     */
    public static void panel(DrawContext context, int x, int y, int w, int h, int color) {
        panel(context, x, y, w, h, RADIUS, color);
    }

    public static void panel(
        DrawContext context, int x, int y, int w, int h, int radius, int color) {
        Shapes.rounded(context, x, y, w, h, radius, color);
    }

    /**
     * Zone collee au bord haut d'un cadre arrondi: l'en-tete du menu.
     *
     * <p>Ses coins hauts suivent le cadre, son bord bas reste droit -- c'est une
     * separation, pas un bord de fenetre. Un rectangle carre a cet endroit
     * laisserait ses angles depasser du cadre.
     */
    public static void panelTop(
        DrawContext context, int x, int y, int w, int h, int radius, int color) {
        Shapes.rounded(context, x, y, w, h, radius, 0, color);
    }

    /** Meme chose, collee au bord bas: la barre laterale. */
    public static void panelBottom(
        DrawContext context, int x, int y, int w, int h, int radius, int color) {
        Shapes.rounded(context, x, y, w, h, 0, radius, color);
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

    /**
     * Coupe un texte en lignes qui tiennent dans une largeur.
     *
     * <p>Coupe aux espaces, et tronque la derniere ligne quand le texte deborde
     * du nombre de lignes disponibles: une description de module a deux lignes
     * sur sa carte, pas davantage, et la carte ne grandit pas pour l'accueillir.
     */
    public static java.util.List<String> wrap(
        TextRenderer font, String value, int maxWidth, int maxLines) {
        java.util.List<String> lines = new java.util.ArrayList<>();
        StringBuilder current = new StringBuilder();

        for (String word : value.split(" ")) {
            String candidate = current.isEmpty() ? word : current + " " + word;
            if (font.getWidth(candidate) <= maxWidth || current.isEmpty()) {
                current.setLength(0);
                current.append(candidate);
                continue;
            }
            lines.add(current.toString());
            current.setLength(0);
            current.append(word);
            if (lines.size() == maxLines) {
                break;
            }
        }

        if (lines.size() < maxLines && !current.isEmpty()) {
            lines.add(current.toString());
        }
        // La derniere ligne porte les points de suspension si le texte continue.
        if (lines.size() == maxLines) {
            int used = 0;
            for (String line : lines) {
                used += line.length() + 1;
            }
            if (used <= value.length()) {
                lines.set(maxLines - 1, fit(font, lines.get(maxLines - 1) + " ...", maxWidth));
            }
        }
        return lines;
    }

    /**
     * Interrupteur de la maquette: une piste arrondie et une pastille.
     *
     * <p>La position dit l'etat, la couleur ne fait que le confirmer -- d'ou
     * l'accent plutot que du vert. Un bandeau « ACTIVE » disait la meme chose
     * en trois fois plus de place, et ne se lisait qu'en le lisant.
     */
    public static void toggle(
        DrawContext context, int x, int y, boolean on, boolean locked) {
        int trackWidth = 18;
        int trackHeight = 9;
        int knob = 7;

        int track = locked ? STATE_LOCKED : (on ? TRACK_ON : TRACK_OFF);
        Shapes.rounded(context, x, y, trackWidth, trackHeight, trackHeight / 2, track);
        if (on && !locked) {
            Shapes.roundedOutline(context, x, y, trackWidth, trackHeight, trackHeight / 2, ACCENT);
        }

        int knobX = on ? x + trackWidth - knob - 1 : x + 1;
        Shapes.rounded(context, knobX, y + 1, knob, knob, knob / 2,
            locked ? TEXT_DIM : (on ? KNOB_ON : KNOB_OFF));
    }

    /** Largeur occupee par {@link #toggle}. */
    public static int toggleWidth() {
        return 18;
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

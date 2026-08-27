package gg.paranoia.client.hud;

import gg.paranoia.client.config.BackgroundStyle;
import gg.paranoia.client.config.HudLayout;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

/**
 * Module qui se dessine a l'ecran et se deplace a la souris depuis le menu.
 *
 * <p>Le dessin passe uniquement par {@code fill} et {@code drawText}: ce sont
 * les deux seules primitives dont la signature n'a pas bouge sur les versions
 * ciblees. Tout le reste (mise a l'echelle, flou) passe par la plateforme.
 */
public abstract class HudElement extends Module {
    /** Marge entre le texte et le bord du fond. */
    protected static final int PADDING = 3;

    /**
     * Numero de l'image en cours de dessin.
     *
     * <p>Statique parce que tous les elements avancent ensemble: il n'existe
     * qu'une image a la fois.
     */
    private static int frame;

    /** Derniere image pour laquelle cet element a prepare son contenu. */
    private int preparedFor = -1;

    private final HudLayout layout = new HudLayout();

    protected HudElement(String id, String name, boolean enabledByDefault) {
        this(id, name, ModuleCategory.HUD, enabledByDefault);
    }

    /**
     * Meme chose, range ailleurs que dans l'onglet HUD.
     *
     * <p>Un element de HUD reste deplacable a la souris et redimensionnable
     * quelle que soit sa categorie: l'editeur travaille sur le type, pas sur
     * l'onglet. La categorie ne decide que de l'endroit ou on va le chercher --
     * et un panneau de diagnostic se cherche avec les optimisations qu'il
     * mesure, pas au milieu des coordonnees et de la boussole.
     */
    protected HudElement(String id, String name, ModuleCategory category, boolean enabledByDefault) {
        super(id, name, category, enabledByDefault);
    }

    public HudLayout layout() {
        return layout;
    }

    /** Ouvre une nouvelle image: les instantanes precedents sont perimes. */
    public static void beginFrame() {
        frame++;
    }

    /**
     * Prepare le contenu de l'image en cours, une seule fois.
     *
     * <p>{@link #width}, {@link #height}, {@link #visibleInGame} et
     * {@link #renderContent} sont appeles chacun au moins une fois par image,
     * et parfois davantage: mesurer une colonne demande de parcourir les memes
     * lignes que les dessiner. Sans ce garde-fou, un panneau d'informations
     * reconstruit six fois par image une liste que le joueur ne voit qu'une
     * fois -- soit, a 240 images par seconde, un millier et demi de listes
     * jetees chaque seconde pour afficher six lignes de texte.
     */
    public final void prepare() {
        if (preparedFor == frame) {
            return;
        }
        preparedFor = frame;
        refresh();
    }

    /**
     * Recalcule ce que l'element affichera pendant cette image.
     *
     * <p>Les implementations gardent leur contenu dans des champs et ne le
     * reconstruisent que si les valeurs sources ont change: entre deux images,
     * des coordonnees ou un nombre d'images par seconde restent le plus souvent
     * identiques, et reformater un texte inchange ne produit que du dechet.
     */
    protected void refresh() {
    }

    /** Position par defaut, en fraction d'ecran, au premier lancement. */
    public void placeAt(double xFraction, double yFraction) {
        layout.setFractions(xFraction, yFraction);
    }

    public abstract int width(TextRenderer textRenderer);

    public abstract int height(TextRenderer textRenderer);

    /** Dessine le contenu, coin superieur gauche en (x, y). */
    public abstract void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y);

    /**
     * Contenu affiche quand le jeu ne fournit rien d'utile: en jeu un HUD de
     * coordonnees a des valeurs, dans le menu il n'y a pas forcement de monde
     * charge. Sans ca, les elements seraient invisibles la ou on les deplace.
     */
    public boolean visibleInGame() {
        return true;
    }

    public void render(DrawContext context, TextRenderer textRenderer, int x, int y) {
        drawBackground(context, x, y, width(textRenderer), height(textRenderer));
        renderContent(context, textRenderer, x + PADDING, y + PADDING);
    }

    protected void drawBackground(DrawContext context, int x, int y, int width, int height) {
        BackgroundStyle style = layout.background();
        if (style == BackgroundStyle.NONE) {
            return;
        }

        int alpha = (int) (0x80 * layout.opacity());
        int color = (alpha << 24);

        switch (style) {
            case SOLID -> context.fill(x, y, x + width, y + height, color);
            case ROUNDED -> {
                // Coins ronges d'un pixel: trois rectangles suffisent, et on
                // reste sur `fill`, seule primitive stable entre les versions.
                context.fill(x + 1, y, x + width - 1, y + height, color);
                context.fill(x, y + 1, x + 1, y + height - 1, color);
                context.fill(x + width - 1, y + 1, x + width, y + height - 1, color);
            }
            case OUTLINE -> {
                int border = ((int) (0xC0 * layout.opacity()) << 24) | 0x00FFFFFF;
                context.fill(x, y, x + width, y + 1, border);
                context.fill(x, y + height - 1, x + width, y + height, border);
                context.fill(x, y + 1, x + 1, y + height - 1, border);
                context.fill(x + width - 1, y + 1, x + width, y + height - 1, border);
            }
            default -> {
            }
        }
    }

    /** Couleur de texte tenant compte de l'opacite reglee pour cet element. */
    protected int textColor(int rgb) {
        int alpha = (int) (0xFF * layout.opacity());
        return (alpha << 24) | (rgb & 0x00FFFFFF);
    }

    protected void drawLine(
        DrawContext context, TextRenderer textRenderer, String text, int x, int y, int rgb) {
        context.drawText(textRenderer, text, x, y, textColor(rgb), layout.textShadow());
    }

    protected static MinecraftClient client() {
        return MinecraftClient.getInstance();
    }
}

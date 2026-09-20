package gg.paranoia.client.hud;

import gg.paranoia.client.config.BackgroundStyle;
import gg.paranoia.client.config.HudFont;
import gg.paranoia.client.config.HudLayout;
import gg.paranoia.client.config.HudStyle;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import gg.paranoia.client.modules.HudAppearanceModule;
import gg.paranoia.client.platform.Platforms;
import gg.paranoia.client.render.Shapes;
import net.minecraft.text.Style;
import net.minecraft.text.Text;
import net.minecraft.util.Identifier;
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

    /**
     * Police pour laquelle {@link #fontStyle} a ete construit.
     *
     * <p>Statiques comme {@link #frame}, et pour la meme raison: il n'y a
     * qu'une police a la fois pour tout le HUD. Construire son style appartient
     * a la plateforme -- {@code withFont} ne prend pas le meme type selon la
     * version de Minecraft -- et sans cette memoire, chaque ligne de chaque
     * element le redemanderait a chaque image.
     */
    private static HudFont styledFont;

    private static Style fontStyle = Style.EMPTY;

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

    /**
     * Le fond d'un module: sa forme vient de l'element, ses couleurs du style.
     *
     * <p>La couleur etait auparavant {@code alpha << 24} -- du noir pur, sans
     * teinte possible. C'est ce qui interdisait d'avoir plusieurs allures: on
     * pouvait changer la forme du fond, jamais sa couleur.
     */
    protected void drawBackground(DrawContext context, int x, int y, int width, int height) {
        HudStyle style = HudAppearanceModule.style();
        BackgroundStyle shape = resolvedShape();
        if (shape == BackgroundStyle.NONE) {
            return;
        }

        float opacity = layout.opacity();
        int panel = style.panelArgb(opacity);
        // Un rayon n'a de sens que sur la forme arrondie: « Plein » veut dire
        // carre, c'est ce qui le distingue.
        int radius = shape == BackgroundStyle.ROUNDED ? style.radius() : 0;

        switch (shape) {
            case SOLID -> context.fill(x, y, x + width, y + height, panel);
            case ROUNDED -> Shapes.rounded(context, x, y, width, height, radius, panel);
            case OUTLINE -> {
                // Le contour seul: pas de remplissage, donc la couleur de
                // bordure du style -- ou du blanc si le style n'en declare
                // pas, faute de quoi la forme ne dessinerait rien du tout.
                int only = style.hasBorder()
                    ? style.borderArgb(opacity)
                    : (((int) (0xC0 * opacity)) << 24) | 0x00FFFFFF;
                Shapes.roundedOutline(context, x, y, width, height, style.radius(), only);
            }
            default -> {
            }
        }

        if (shape != BackgroundStyle.OUTLINE && style.hasBorder()) {
            Shapes.roundedOutline(
                context, x, y, width, height, radius, style.borderArgb(opacity));
        }

        // L'arete lumineuse du bord haut, posee en dernier pour rester
        // au-dessus de la bordure. Un seul pixel de haut: c'est la lumiere qui
        // accroche la tranche, pas un second trait. Elle demarre ou demarre le
        // premier pixel de la forme, sinon elle deborde du coin.
        if (style.hasEdge()) {
            int inset = Shapes.topInset(radius, width, height);
            context.fill(x + inset, y, x + width - inset, y + 1, style.edgeArgb(opacity));
        }
    }

    /**
     * La forme reellement dessinee: celle du module, ou celle du style quand
     * le module est en {@link BackgroundStyle#AUTO}.
     */
    public BackgroundStyle resolvedShape() {
        BackgroundStyle chosen = layout.background();
        return chosen == BackgroundStyle.AUTO ? HudAppearanceModule.style().shape() : chosen;
    }

    /** Couleur de texte tenant compte de l'opacite reglee pour cet element. */
    protected int textColor(int rgb) {
        int alpha = (int) (0xFF * layout.opacity());
        return (alpha << 24) | (rgb & 0x00FFFFFF);
    }

    /**
     * L'ombre du texte.
     *
     * <p>Sans fond, elle est imposee: c'est elle seule qui detache les
     * chiffres d'un ciel clair ou d'une plaine enneigee, et un joueur qui
     * l'aurait eteinte sous un fond plein se retrouverait avec un HUD
     * illisible en passant au style epure -- sans comprendre pourquoi.
     */
    public boolean textShadow() {
        return resolvedShape() == BackgroundStyle.NONE || layout.textShadow();
    }

    private static Style fontStyle() {
        HudFont chosen = HudAppearanceModule.font();
        if (chosen != styledFont) {
            styledFont = chosen;
            Identifier id = chosen.id();
            fontStyle = id == null ? Style.EMPTY : Platforms.get().fontStyle(id);
        }
        return fontStyle;
    }

    /**
     * Le texte, habille de la police choisie.
     *
     * <p>Minecraft selectionne une police par le style du {@code Text}, pas
     * par un {@code TextRenderer} different: il n'y a donc rien a remplacer
     * dans la chaine de dessin. La police du jeu ne pose aucun style -- un
     * {@code Style.EMPTY} inutile se propagerait a chaque ligne de chaque HUD,
     * a chaque trame.
     *
     * <p>Le test porte sur le style rendu et non sur l'identifiant, ce qui
     * couvre du meme coup une version qui ne saurait pas designer de police:
     * {@link gg.paranoia.client.platform.ClientPlatform#fontStyle} rend alors
     * {@code Style.EMPTY}, et on repasse par le chemin de la police du jeu au
     * lieu de poser un style vide sur chaque ligne.
     */
    protected Text label(String text) {
        Style style = fontStyle();
        return style == Style.EMPTY
            ? Text.literal(text)
            : Text.literal(text).setStyle(style);
    }

    /**
     * La largeur du texte dans la police choisie.
     *
     * <p>A utiliser partout ou l'on mesurait {@code textRenderer.getWidth} sur
     * une chaine: cette surcharge-la ignore le style et rend donc la largeur
     * en police du jeu. Mesurer avec l'une et dessiner avec l'autre donne des
     * fonds trop courts ou trop longs, et des colonnes qui ne s'alignent plus.
     */
    protected int measure(TextRenderer textRenderer, String text) {
        return textRenderer.getWidth(label(text));
    }

    protected void drawLine(
        DrawContext context, TextRenderer textRenderer, String text, int x, int y, int rgb) {
        context.drawText(textRenderer, label(text), x, y, textColor(rgb), textShadow());
    }

    protected static MinecraftClient client() {
        return MinecraftClient.getInstance();
    }
}

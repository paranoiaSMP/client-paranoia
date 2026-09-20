package gg.paranoia.client.config;

/**
 * L'allure generale du HUD, choisie une fois pour tous les modules.
 *
 * <p>{@link BackgroundStyle} dit deja quelle <em>forme</em> a le fond d'un
 * module, reglable element par element. Ce qui manquait est au-dessus: une
 * allure d'ensemble qu'on choisit d'un geste. Obtenir un HUD coherent
 * demandait sinon de regler la forme, l'opacite et l'ombre du texte sur onze
 * modules a la main, et de recommencer pour en changer.
 *
 * <p>Un style ne modifie rien: il <em>fournit</em> une forme, des couleurs et
 * une opacite que le dessin lui demande a chaque trame. C'est
 * {@link BackgroundStyle#AUTO} qui relie les deux -- un module en AUTO suit le
 * style, un module regle explicitement garde sa derogation.
 *
 * <p>Ecrire les valeurs dans chaque module au moment du choix aurait ete plus
 * direct, et faux: changer de style aurait efface les reglages de qui en a
 * repris un a la main, sans moyen de les retrouver.
 *
 * <p>Le fond etait jusqu'ici noir pur, quel que soit le reste: {@code
 * alpha << 24} ne laisse aucune place a une teinte. C'est ce qui empechait
 * d'avoir plusieurs allures, et non l'absence de reglages.
 */
public enum HudStyle {

    /**
     * Rien derriere le texte.
     *
     * <p>Seul style ou l'ombre du texte est allumee, et ce n'est pas un gout:
     * sans fond, c'est elle qui rend les chiffres lisibles au-dessus d'un ciel
     * clair ou d'une plaine enneigee. L'eteindre ici rendrait le HUD illisible
     * une fois sur deux.
     */
    EPURE("Épuré", BackgroundStyle.NONE, 0, 0x000000, 0f, 0x000000, 0f, 0x000000, 0f, 1.00f, true),

    /**
     * Discret et arrondi, sans bordure.
     *
     * <p>L'allure des clients concurrents: un voile sombre qui detache le
     * texte du decor sans rien affirmer. Aucune couleur de marque -- c'est
     * justement ce qui la rend neutre.
     */
    FEATHER("Feather", BackgroundStyle.ROUNDED, 5, 0x000000, 0.40f, 0x000000, 0f, 0x000000, 0f, 1.00f, false),

    /**
     * La gamme du launcher, portee en jeu.
     *
     * <p>Surface {@code #232532} et liseré {@code #3F424D}: les memes valeurs
     * que les panneaux du launcher. C'est le seul style qui relie les deux
     * moities du client, et le seul ou le fond a une teinte plutot qu'une
     * simple obscurite.
     */
    NOCTURNE("Nocturne", BackgroundStyle.ROUNDED, 5, 0x232532, 0.85f, 0x3F424D, 1.00f, 0x000000, 0f, 1.00f, false),

    /**
     * Verre.
     *
     * <p>Le flou n'existe pas: {@code DrawContext} ne sait pas lire ce qu'il y
     * a derriere lui, donc un veritable {@code backdrop-filter} est hors de
     * portee ici. Ce qui fait lire « verre » est ailleurs, et se dessine avec
     * des rectangles: un fond tres transparent, un liseré clair, et surtout
     * une arete lumineuse d'un pixel sur le bord haut -- la lumiere qui
     * accroche la tranche. C'est ce dernier trait qui porte l'effet; sans lui
     * il ne reste qu'un fond pale.
     */
    VERRE("Verre", BackgroundStyle.ROUNDED, 5, 0x161826, 0.45f, 0xFFFFFF, 0.14f, 0xFFFFFF, 0.22f, 1.00f, false);

    private final String label;
    private final BackgroundStyle shape;
    private final int radius;
    private final int panelRgb;
    private final float panelAlpha;
    private final int borderRgb;
    private final float borderAlpha;
    private final int edgeRgb;
    private final float edgeAlpha;
    private final float opacity;
    private final boolean textShadow;

    HudStyle(
        String label,
        BackgroundStyle shape,
        int radius,
        int panelRgb,
        float panelAlpha,
        int borderRgb,
        float borderAlpha,
        int edgeRgb,
        float edgeAlpha,
        float opacity,
        boolean textShadow) {
        this.label = label;
        this.shape = shape;
        this.radius = radius;
        this.panelRgb = panelRgb;
        this.panelAlpha = panelAlpha;
        this.borderRgb = borderRgb;
        this.borderAlpha = borderAlpha;
        this.edgeRgb = edgeRgb;
        this.edgeAlpha = edgeAlpha;
        this.opacity = opacity;
        this.textShadow = textShadow;
    }

    public String label() {
        return label;
    }

    public BackgroundStyle shape() {
        return shape;
    }

    /**
     * Le rayon des coins, en pixels de l'espace de coordonnees du jeu.
     *
     * <p>Cinq, et non huit comme le dit la maquette: celle-ci est dessinee sur
     * une scene large de 1600 pixels, alors que l'interface du jeu en compte
     * environ 960 a l'echelle 2. Huit sur 1600 font cinq ici.
     */
    public int radius() {
        return radius;
    }

    public boolean hasBorder() {
        return borderAlpha > 0f;
    }

    /** Une arete claire sur le bord haut: ce qui fait lire « verre ». */
    public boolean hasEdge() {
        return edgeAlpha > 0f;
    }

    /**
     * Les couleurs finales, l'opacite du module comprise.
     *
     * <p>Les deux opacites se multiplient au lieu de se remplacer: celle du
     * style donne l'allure, celle du module reste un reglage du joueur. Un
     * module passe a 50 % doit s'effacer quel que soit le style choisi.
     */
    public int panelArgb(float moduleOpacity) {
        return argb(panelRgb, panelAlpha * opacity * moduleOpacity);
    }

    public int borderArgb(float moduleOpacity) {
        return argb(borderRgb, borderAlpha * opacity * moduleOpacity);
    }

    public int edgeArgb(float moduleOpacity) {
        return argb(edgeRgb, edgeAlpha * opacity * moduleOpacity);
    }

    private static int argb(int rgb, float alpha) {
        int a = Math.round(Math.max(0f, Math.min(1f, alpha)) * 255f);
        return (a << 24) | (rgb & 0x00FFFFFF);
    }

    /**
     * L'opacite propre au style, avant celle du module.
     *
     * <p>Les deux se multiplient dans {@link #panelArgb}: le style donne
     * l'allure, le module reste un reglage du joueur.
     */
    public float opacity() {
        return opacity;
    }

    /** Ombre du texte voulue par ce style. */
    public boolean textShadow() {
        return textShadow;
    }
}

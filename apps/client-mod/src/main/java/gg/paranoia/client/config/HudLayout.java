package gg.paranoia.client.config;

/**
 * Position et apparence d'un HUD.
 *
 * <p>La position est stockee en fraction de l'ecran, pas en pixels: le launcher
 * laisse choisir la resolution, et des coordonnees absolues envoyaient les HUD
 * hors ecran des qu'on en changeait.
 *
 * <p>Le coin d'ancrage est deduit de la position plutot que reglable: un HUD
 * pose a droite doit rester colle a droite quand son contenu s'allonge (un ping
 * a trois chiffres, des coordonnees negatives), sans que le joueur ait a y
 * penser.
 */
public final class HudLayout {
    private double xFraction;
    private double yFraction;
    private float scale = 1.0f;
    private float opacity = 1.0f;
    private BackgroundStyle background = BackgroundStyle.SOLID;
    private boolean textShadow = true;

    public HudLayout() {
    }

    public HudLayout(double xFraction, double yFraction) {
        setFractions(xFraction, yFraction);
    }

    public void setFractions(double xFraction, double yFraction) {
        this.xFraction = Math.min(Math.max(xFraction, 0.0), 1.0);
        this.yFraction = Math.min(Math.max(yFraction, 0.0), 1.0);
    }

    public double xFraction() {
        return xFraction;
    }

    public double yFraction() {
        return yFraction;
    }

    /** Coin de l'ecran vers lequel l'element grandit, deduit de sa position. */
    public boolean anchoredRight() {
        return xFraction > 0.5;
    }

    public boolean anchoredBottom() {
        return yFraction > 0.5;
    }

    public int x(int screenWidth, int elementWidth) {
        int raw = (int) Math.round(xFraction * screenWidth);
        // Ancre a droite: c'est le bord droit de l'element qui est fixe.
        int position = anchoredRight() ? raw - elementWidth : raw;
        return clamp(position, screenWidth, elementWidth);
    }

    public int y(int screenHeight, int elementHeight) {
        int raw = (int) Math.round(yFraction * screenHeight);
        int position = anchoredBottom() ? raw - elementHeight : raw;
        return clamp(position, screenHeight, elementHeight);
    }

    /** Un HUD entierement hors ecran serait irrecuperable a la souris. */
    private static int clamp(int position, int available, int size) {
        int max = Math.max(0, available - size);
        return Math.min(Math.max(position, 0), max);
    }

    /** Enregistre une position exprimee en pixels apres un glisser-deposer. */
    public void moveTo(int x, int y, int screenWidth, int screenHeight, int elementWidth, int elementHeight) {
        if (screenWidth <= 0 || screenHeight <= 0) {
            return;
        }

        double centerX = (x + elementWidth / 2.0) / screenWidth;
        double centerY = (y + elementHeight / 2.0) / screenHeight;

        // On reprend le coin d'ancrage du nouveau centre, puis on enregistre le
        // bord correspondant: sinon un element depose a droite reste ancre a
        // gauche et se decale des que son contenu change de largeur.
        this.xFraction = centerX > 0.5 ? (double) (x + elementWidth) / screenWidth : (double) x / screenWidth;
        this.yFraction = centerY > 0.5 ? (double) (y + elementHeight) / screenHeight : (double) y / screenHeight;
    }

    public float scale() {
        return scale;
    }

    public void setScale(float scale) {
        this.scale = Math.min(Math.max(scale, 0.5f), 3.0f);
    }

    public float opacity() {
        return opacity;
    }

    public void setOpacity(float opacity) {
        this.opacity = Math.min(Math.max(opacity, 0.0f), 1.0f);
    }

    public BackgroundStyle background() {
        return background;
    }

    public void setBackground(BackgroundStyle background) {
        this.background = background;
    }

    public boolean textShadow() {
        return textShadow;
    }

    public void setTextShadow(boolean textShadow) {
        this.textShadow = textShadow;
    }
}

package gg.paranoia.client.config;

/** Forme du fond derriere un HUD, reglable element par element. */
public enum BackgroundStyle {
    NONE("Aucun"),
    SOLID("Plein"),
    ROUNDED("Arrondi"),
    OUTLINE("Contour");

    private final String label;

    BackgroundStyle(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}

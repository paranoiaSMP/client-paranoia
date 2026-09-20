package gg.paranoia.client.config;

/**
 * Forme du fond derriere un HUD, reglable element par element.
 *
 * <p>{@link #AUTO} est le defaut et la valeur interessante: le module suit
 * alors le style choisi pour le client entier. Les quatre autres sont des
 * derogations -- un module que le joueur a voulu different des siens.
 *
 * <p>C'est ce qui permet de changer l'allure de tout le HUD d'un geste sans
 * effacer les reglages de qui en a repris un a la main. Une configuration
 * enregistree avant ce choix porte une valeur explicite, donc elle garde son
 * apparence: la derogation est exactement ce qu'elle exprimait.
 */
public enum BackgroundStyle {
    AUTO("Automatique"),
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

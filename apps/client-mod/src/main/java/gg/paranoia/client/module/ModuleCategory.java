package gg.paranoia.client.module;

/** Onglets de la barre laterale du menu. */
public enum ModuleCategory {
    HUD("HUD"),
    VISUEL("Visuel"),
    COMBAT("Combat"),
    /**
     * Ce qui echange du detail contre des images par seconde.
     *
     * <p>Un onglet a part, et pas un fourre-tout de plus dans « Visuel »: ces
     * reglages sont les seuls du mod qui retirent quelque chose a l'ecran. Les
     * regrouper permet de les trouver quand on cherche des FPS, et de voir d'un
     * coup d'oeil tout ce qu'on a accepte de sacrifier.
     */
    OPTIMISATION("Optimisation"),
    PARAMETRES("Parametres");

    private final String label;

    ModuleCategory(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}

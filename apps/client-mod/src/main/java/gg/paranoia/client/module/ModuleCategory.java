package gg.paranoia.client.module;

/** Onglets de la barre laterale du menu. */
public enum ModuleCategory {
    HUD("HUD"),
    VISUEL("Visuel"),
    COMBAT("Combat"),
    PARAMETRES("Parametres");

    private final String label;

    ModuleCategory(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}

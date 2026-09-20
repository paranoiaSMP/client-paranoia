package gg.paranoia.client.module;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Fonctionnalite activable, avec ses options. */
public abstract class Module {
    private final String id;
    private final String name;
    private final ModuleCategory category;
    private final List<Setting<?>> settings = new ArrayList<>();

    /**
     * Une phrase qui dit ce que fait le module, affichee sur sa carte.
     *
     * <p>Posee par le constructeur plutot que passee a {@code super}: la
     * signature de {@link Module} est heritee par vingt-deux classes, et une
     * description est du texte, pas une dependance. Vide par defaut -- la carte
     * se contente alors du nom, sans reserver de place pour rien.
     */
    private String description = "";

    private boolean enabled;

    /**
     * Interdit par le serveur. Le module reste visible dans le menu, grise:
     * le cacher laisserait croire a un bug plutot qu'a une regle.
     */
    private boolean lockedByServer;

    protected Module(String id, String name, ModuleCategory category, boolean enabledByDefault) {
        this.id = id;
        this.name = name;
        this.category = category;
        this.enabled = enabledByDefault;
    }

    protected <S extends Setting<?>> S add(S setting) {
        settings.add(setting);
        return setting;
    }

    public String id() {
        return id;
    }

    public String name() {
        return name;
    }

    /** A appeler dans le constructeur du module. */
    protected void describe(String text) {
        this.description = text;
    }

    public String description() {
        return description;
    }

    public ModuleCategory category() {
        return category;
    }

    public List<Setting<?>> settings() {
        return Collections.unmodifiableList(settings);
    }

    public boolean enabled() {
        return enabled && !lockedByServer;
    }

    /** Ce que le joueur a choisi, meme si le serveur l'interdit pour l'instant. */
    public boolean enabledByPlayer() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public boolean lockedByServer() {
        return lockedByServer;
    }

    public void setLockedByServer(boolean locked) {
        this.lockedByServer = locked;
    }
}

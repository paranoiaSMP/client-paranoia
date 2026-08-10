package gg.paranoia.client.module;

import com.google.gson.JsonElement;

/**
 * Une option reglable d'un module.
 *
 * <p>Le menu se dessine a partir de cette liste: ajouter une option a un module
 * ne demande jamais de toucher au code de l'interface.
 */
public abstract class Setting<T> {
    private final String id;
    private final String label;
    protected T value;

    protected Setting(String id, String label, T defaultValue) {
        this.id = id;
        this.label = label;
        this.value = defaultValue;
    }

    public String id() {
        return id;
    }

    public String label() {
        return label;
    }

    public T value() {
        return value;
    }

    public void set(T value) {
        this.value = value;
    }

    public abstract JsonElement toJson();

    /** Une valeur absente ou d'un type inattendu laisse l'option a son defaut. */
    public abstract void fromJson(JsonElement json);
}

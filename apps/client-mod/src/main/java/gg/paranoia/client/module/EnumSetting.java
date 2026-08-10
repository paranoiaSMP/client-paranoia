package gg.paranoia.client.module;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;

import java.util.function.Function;

/** Choix parmi les constantes d'une enumeration, parcourues au clic. */
public final class EnumSetting<E extends Enum<E>> extends Setting<E> {
    private final E[] options;
    private final Function<E, String> labelOf;

    public EnumSetting(String id, String label, E defaultValue, E[] options, Function<E, String> labelOf) {
        super(id, label, defaultValue);
        this.options = options;
        this.labelOf = labelOf;
    }

    public E get() {
        return value;
    }

    public String display() {
        return labelOf.apply(value);
    }

    /** Passe a l'option suivante, en revenant au debut apres la derniere. */
    public void cycle(int direction) {
        int index = value.ordinal() + direction;
        int wrapped = ((index % options.length) + options.length) % options.length;
        value = options[wrapped];
    }

    @Override
    public JsonElement toJson() {
        return new JsonPrimitive(value.name());
    }

    @Override
    public void fromJson(JsonElement json) {
        if (json == null || !json.isJsonPrimitive()) {
            return;
        }
        String name = json.getAsString();
        for (E option : options) {
            if (option.name().equals(name)) {
                value = option;
                return;
            }
        }
        // Nom inconnu (option retiree entre deux versions): on garde le defaut.
    }
}

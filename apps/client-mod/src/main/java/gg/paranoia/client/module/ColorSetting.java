package gg.paranoia.client.module;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;

/** Couleur ARGB. Stockee en hexadecimal pour rester lisible dans le fichier. */
public final class ColorSetting extends Setting<Integer> {
    public ColorSetting(String id, String label, int defaultArgb) {
        super(id, label, defaultArgb);
    }

    public int argb() {
        return value;
    }

    /** Meme couleur, mais dont l'alpha est multiplie par l'opacite du HUD. */
    public int argbWithOpacity(float opacity) {
        int alpha = (int) (((value >> 24) & 0xFF) * Math.min(Math.max(opacity, 0f), 1f));
        return (alpha << 24) | (value & 0x00FFFFFF);
    }

    @Override
    public JsonElement toJson() {
        return new JsonPrimitive(String.format("#%08X", value));
    }

    @Override
    public void fromJson(JsonElement json) {
        if (json == null || !json.isJsonPrimitive()) {
            return;
        }
        try {
            String text = json.getAsString().trim();
            if (text.startsWith("#")) {
                text = text.substring(1);
            }
            // parseUnsignedInt: un ARGB opaque depasse Integer.MAX_VALUE.
            value = Integer.parseUnsignedInt(text, 16);
        } catch (RuntimeException ignored) {
            // Couleur illisible: on garde la valeur par defaut.
        }
    }
}

package gg.paranoia.client.module;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;

public final class BooleanSetting extends Setting<Boolean> {
    public BooleanSetting(String id, String label, boolean defaultValue) {
        super(id, label, defaultValue);
    }

    public boolean get() {
        return value;
    }

    public void toggle() {
        value = !value;
    }

    @Override
    public JsonElement toJson() {
        return new JsonPrimitive(value);
    }

    @Override
    public void fromJson(JsonElement json) {
        if (json != null && json.isJsonPrimitive() && json.getAsJsonPrimitive().isBoolean()) {
            value = json.getAsBoolean();
        }
    }
}

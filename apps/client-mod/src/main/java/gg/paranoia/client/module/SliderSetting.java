package gg.paranoia.client.module;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;

/** Valeur numerique bornee, reglee au curseur dans le menu. */
public final class SliderSetting extends Setting<Double> {
    private final double min;
    private final double max;
    private final double step;
    private final String unit;

    public SliderSetting(String id, String label, double defaultValue, double min, double max, double step) {
        this(id, label, defaultValue, min, max, step, "");
    }

    public SliderSetting(
        String id, String label, double defaultValue, double min, double max, double step, String unit) {
        super(id, label, defaultValue);
        this.min = min;
        this.max = max;
        this.step = step;
        this.unit = unit;
    }

    public double get() {
        return value;
    }

    public float getFloat() {
        return value.floatValue();
    }

    public int getInt() {
        return (int) Math.round(value);
    }

    @Override
    public void set(Double raw) {
        double clamped = Math.min(Math.max(raw, min), max);
        // Arrondi au pas le plus proche, sinon un curseur produit des valeurs
        // du type 0.7300000000000001 qui s'affichent mal et polluent le fichier.
        double snapped = step > 0 ? Math.round(clamped / step) * step : clamped;
        super.set(Math.min(Math.max(snapped, min), max));
    }

    /** Position 0..1 du curseur, pour le dessin et la saisie a la souris. */
    public double fraction() {
        return max > min ? (value - min) / (max - min) : 0.0;
    }

    public void setFraction(double fraction) {
        set(min + Math.min(Math.max(fraction, 0.0), 1.0) * (max - min));
    }

    public String display() {
        String number = step >= 1 ? String.valueOf(getInt()) : String.format("%.2f", value);
        return unit.isEmpty() ? number : number + unit;
    }

    @Override
    public JsonElement toJson() {
        return new JsonPrimitive(value);
    }

    @Override
    public void fromJson(JsonElement json) {
        if (json != null && json.isJsonPrimitive() && json.getAsJsonPrimitive().isNumber()) {
            set(json.getAsDouble());
        }
    }
}

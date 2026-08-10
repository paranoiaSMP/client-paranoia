package gg.paranoia.client.modules;

import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import gg.paranoia.client.module.EnumSetting;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import gg.paranoia.client.module.SliderSetting;

/** Crosshair dessine par le client a la place de celui du jeu. */
public final class CrosshairModule extends Module {
    public enum Shape {
        CROSS("Croix"),
        DOT("Point"),
        CIRCLE("Cercle"),
        TEE("T inverse");

        private final String label;

        Shape(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    private static CrosshairModule instance;

    private final EnumSetting<Shape> shape = add(new EnumSetting<>(
        "shape", "Forme", Shape.CROSS, Shape.values(), Shape::label));
    private final SliderSetting length = add(new SliderSetting("length", "Longueur", 5, 1, 15, 1));
    private final SliderSetting thickness = add(new SliderSetting("thickness", "Epaisseur", 1, 1, 4, 1));
    private final SliderSetting gap = add(new SliderSetting("gap", "Ecart central", 2, 0, 10, 1));
    private final ColorSetting color = add(new ColorSetting("color", "Couleur", 0xFFFFFFFF));
    private final BooleanSetting outline = add(new BooleanSetting("outline", "Contour noir", true));
    private final BooleanSetting dynamic =
        add(new BooleanSetting("dynamic", "S'ecarte pendant le cooldown", false));

    public CrosshairModule() {
        super("crosshair", "Crosshair", ModuleCategory.COMBAT, false);
        instance = this;
    }

    public static CrosshairModule instance() {
        return instance;
    }

    public Shape shape() {
        return shape.get();
    }

    public int length() {
        return length.getInt();
    }

    public int thickness() {
        return thickness.getInt();
    }

    /** Ecart au centre, elargi pendant le cooldown si l'option est active. */
    public int gap(float cooldownProgress) {
        int base = gap.getInt();
        if (!dynamic.get()) {
            return base;
        }
        // Progression a 1 = arme prete: l'ecart revient a sa valeur de repos.
        return base + Math.round((1f - cooldownProgress) * 4f);
    }

    public int color() {
        return color.argb();
    }

    public boolean outline() {
        return outline.get();
    }
}

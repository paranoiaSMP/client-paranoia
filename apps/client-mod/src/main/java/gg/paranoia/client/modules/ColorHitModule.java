package gg.paranoia.client.modules;

import gg.paranoia.client.module.ColorSetting;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;

/**
 * Remplace la teinte rouge des entites touchees par une couleur au choix.
 *
 * <p>On se greffe sur la teinte que le jeu applique deja lorsqu'une entite
 * encaisse un coup, plutot que de suivre nous-memes qui a frappe qui: le jeu
 * sait deja quand teinter, on ne change que la couleur.
 */
public final class ColorHitModule extends Module {
    private static ColorHitModule instance;

    private final ColorSetting color =
        add(new ColorSetting("color", "Couleur du coup", 0xB0FF3C3C));

    public ColorHitModule() {
        super("colorhit", "Color hit", ModuleCategory.COMBAT, false);
        instance = this;
    }

    public static ColorHitModule instance() {
        return instance;
    }

    public int color() {
        return color.argb();
    }
}

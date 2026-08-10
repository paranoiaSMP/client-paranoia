package gg.paranoia.client.modules;

import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import gg.paranoia.client.module.SliderSetting;

/**
 * Eclaircit le rendu du monde.
 *
 * <p>Le reglage agit sur la courbe de luminosite du jeu et peut la pousser
 * au-dela de ce que permettent les options vanilla, bornees a 100%. C'est un
 * avantage reel en grotte et en combat: le module est donc prevu pour etre
 * interdit par le serveur, via {@link Module#setLockedByServer(boolean)}.
 */
public final class BrightnessModule extends Module {
    /**
     * Le mixin s'execute dans le rendu, plusieurs fois par image et sans
     * contexte: il lui faut un acces direct, sans traverser le registre.
     */
    private static BrightnessModule instance;

    private final SliderSetting level =
        add(new SliderSetting("level", "Niveau", 100, 0, 100, 5, "%"));

    public BrightnessModule() {
        super("brightness", "Luminosite", ModuleCategory.VISUEL, false);
        instance = this;
    }

    public static BrightnessModule instance() {
        return instance;
    }

    /**
     * Luminosite minimale imposee, entre 0 et 1.
     *
     * <p>A 100% le monde est entierement eclaire; a 0% le module ne change rien,
     * ce qui evite d'avoir a l'activer et le desactiver pour comparer.
     */
    public float floor() {
        return (float) (level.get() / 100.0);
    }
}

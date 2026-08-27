package gg.paranoia.client.modules;

import gg.paranoia.client.module.KeySetting;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import org.lwjgl.glfw.GLFW;

/**
 * Quelle touche ouvre le menu Paranoia.
 *
 * <p>Maj droite etait code en dur, et le commentaire qui l'expliquait
 * promettait deja que « le menu proposera son propre reglage ». Voila le
 * reglage: on clique sur la ligne, on appuie sur la touche voulue, n'importe
 * laquelle. Echap annule, Retour arriere delie.
 *
 * <p>Desactiver le module retire l'ouverture au clavier entierement. C'est
 * volontairement un vrai choix et non un interrupteur decoratif: quelqu'un qui
 * lie une macro a la meme touche, ou qui prefere n'ouvrir le menu que depuis le
 * launcher, a une facon de le dire.
 */
public final class MenuKeyModule extends Module {
    /** Lu depuis la boucle de tick: acces direct requis. */
    private static MenuKeyModule instance;

    private final KeySetting key = add(new KeySetting(
        "key", "Touche d'ouverture", GLFW.GLFW_KEY_RIGHT_SHIFT));

    public MenuKeyModule() {
        super("menuKey", "Ouverture au clavier", ModuleCategory.PARAMETRES, true);
        instance = this;
    }

    /**
     * @return le code GLFW a surveiller, ou {@link KeySetting#NONE} si
     *     l'ouverture au clavier est desactivee ou deliee.
     */
    public static int code() {
        MenuKeyModule module = instance;
        if (module == null || !module.enabled()) {
            return KeySetting.NONE;
        }
        return module.key.get();
    }
}

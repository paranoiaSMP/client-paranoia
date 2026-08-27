package gg.paranoia.client.modules;

import gg.paranoia.client.module.EnumSetting;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import org.lwjgl.glfw.GLFW;

/**
 * Quelle touche ouvre le menu Paranoia.
 *
 * <p>Maj droite etait code en dur, et le commentaire qui l'expliquait promettait
 * deja que « le menu proposera son propre reglage ». Voila le reglage.
 *
 * <p>Une liste de touches plutot qu'une capture au clavier: capturer demanderait
 * un widget de saisie dans le menu, avec son etat « appuyez sur une touche », sa
 * gestion de l'echappement et son risque de laisser le joueur coince sur une
 * touche qu'il ne peut plus atteindre. La liste couvre les touches qu'on veut
 * reellement -- aucune n'est utilisee par le jeu en vanilla -- et se regle d'un
 * clic.
 *
 * <p>Desactiver le module retire l'ouverture au clavier entierement. C'est
 * volontairement un vrai choix et non un interrupteur decoratif: quelqu'un qui
 * lie une macro a la meme touche, ou qui prefere n'ouvrir le menu que depuis le
 * launcher, a une facon de le dire.
 */
public final class MenuKeyModule extends Module {
    /** Lu depuis la boucle de tick: acces direct requis. */
    private static MenuKeyModule instance;

    /**
     * Touches proposees.
     *
     * <p>Aucune n'est liee a quoi que ce soit par defaut dans Minecraft, ce qui
     * evite d'ouvrir le menu en voulant faire autre chose. B figure en tete des
     * lettres parce que c'est celle qu'on demande le plus souvent.
     */
    public enum Key {
        MAJ_DROITE("Maj droite", GLFW.GLFW_KEY_RIGHT_SHIFT),
        B("B", GLFW.GLFW_KEY_B),
        N("N", GLFW.GLFW_KEY_N),
        CTRL_DROIT("Ctrl droit", GLFW.GLFW_KEY_RIGHT_CONTROL),
        INSER("Inser", GLFW.GLFW_KEY_INSERT),
        F6("F6", GLFW.GLFW_KEY_F6),
        F7("F7", GLFW.GLFW_KEY_F7);

        private final String label;
        private final int code;

        Key(String label, int code) {
            this.label = label;
            this.code = code;
        }

        public String label() {
            return label;
        }

        public int code() {
            return code;
        }
    }

    private final EnumSetting<Key> key = add(new EnumSetting<>(
        "key", "Touche d'ouverture", Key.MAJ_DROITE, Key.values(), Key::label));

    public MenuKeyModule() {
        super("menuKey", "Ouverture au clavier", ModuleCategory.PARAMETRES, true);
        instance = this;
    }

    /**
     * @return le code GLFW a surveiller, ou {@code -1} si l'ouverture au
     *     clavier est desactivee.
     */
    public static int code() {
        MenuKeyModule module = instance;
        if (module == null || !module.enabled()) {
            return -1;
        }
        return module.key.get().code();
    }
}

package gg.paranoia.client.modules;

import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import gg.paranoia.client.module.SliderSetting;
import net.minecraft.client.MinecraftClient;

/**
 * Ralentit le rendu quand la fenetre n'a pas le focus.
 *
 * <p>Minecraft possede deja un limiteur d'inactivite, et il fait l'essentiel du
 * travail: fenetre reduite, menu ouvert, et deux paliers apres une longue
 * absence de saisie. Ce module ne comble qu'un seul trou, mais un trou reel --
 * le limiteur du jeu se declenche sur l'<em>inactivite</em>, pas sur le
 * <em>focus</em>. Basculer sur Discord laisse donc le jeu dessiner a pleine
 * vitesse pendant une bonne minute, pour une fenetre que personne ne regarde.
 *
 * <p>La valeur ne fait que <em>baisser</em> celle du jeu, jamais l'inverse:
 * quand vanilla est deja plus strict -- fenetre reduite, absence prolongee --
 * c'est vanilla qui gagne. On ne peut donc pas, par ce reglage, rendre le jeu
 * plus gourmand qu'il ne l'aurait ete.
 *
 * <p>Desactive par defaut, et pas par prudence de principe: quelqu'un qui
 * diffuse sa partie garde la fenetre du jeu capturee pendant qu'il travaille
 * ailleurs. Brider a trente images par seconde ruinerait son direct sans qu'il
 * comprenne pourquoi.
 */
public final class FocusFpsModule extends Module {
    /** Le mixin s'execute dans la boucle de rendu: acces direct requis. */
    private static FocusFpsModule instance;

    private final SliderSetting limit = add(new SliderSetting(
        "limit", "Images par seconde hors focus", 30, 5, 120, 5, " FPS"));

    public FocusFpsModule() {
        super("focusFps", "Ralentir hors focus", ModuleCategory.VISUEL, false);
        instance = this;
    }

    /**
     * Abaisse la limite du jeu si la fenetre n'a pas le focus.
     *
     * @param vanillaLimit ce que le limiteur du jeu venait de decider.
     * @return la limite a appliquer, jamais plus haute que celle recue.
     */
    public static int clamp(int vanillaLimit) {
        FocusFpsModule module = instance;
        if (module == null || !module.enabled()) {
            return vanillaLimit;
        }

        MinecraftClient client = MinecraftClient.getInstance();
        if (client == null || client.isWindowFocused()) {
            return vanillaLimit;
        }

        return Math.min(vanillaLimit, module.limit.getInt());
    }
}

package gg.paranoia.client.modules;

import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import net.minecraft.client.MinecraftClient;
import net.minecraft.util.hit.HitResult;

/**
 * Colore le crosshair selon ce qui se trouve devant et l'etat de l'arme.
 *
 * <p>Il ne s'agit pas d'un calcul de portee maison: on lit la cible que le jeu
 * a lui-meme retenue sous le viseur. Elle tient deja compte de la portee
 * d'attaque du joueur, des blocs qui font obstacle et du mode de jeu.
 */
public final class HitIndicatorModule extends Module {
    private static HitIndicatorModule instance;

    private final ColorSetting reachColor =
        add(new ColorSetting("reach", "Cible a portee", 0xFF7CFF9E));
    private final ColorSetting readyColor =
        add(new ColorSetting("ready", "Cible et arme chargee", 0xFFFFE07C));
    private final BooleanSetting onlyLiving =
        add(new BooleanSetting("onlyLiving", "Entites uniquement", true));

    public HitIndicatorModule() {
        super("hitindicator", "Indicateur de portee", ModuleCategory.COMBAT, false);
        instance = this;
    }

    public static HitIndicatorModule instance() {
        return instance;
    }

    /**
     * Couleur a appliquer au crosshair, ou 0 s'il n'y a rien a signaler.
     *
     * @param cooldownProgress avancement du cooldown d'attaque, 1 = arme prete
     */
    public int colorFor(float cooldownProgress) {
        if (!enabled()) {
            return 0;
        }

        MinecraftClient client = MinecraftClient.getInstance();
        if (client == null || client.crosshairTarget == null) {
            return 0;
        }

        HitResult.Type type = client.crosshairTarget.getType();
        boolean onEntity = type == HitResult.Type.ENTITY;
        if (!onEntity && (onlyLiving.get() || type != HitResult.Type.BLOCK)) {
            return 0;
        }

        // Frapper avec une arme non rechargee coute la quasi-totalite des degats:
        // distinguer les deux etats est tout l'interet de l'indicateur.
        return cooldownProgress >= 1.0f ? readyColor.argb() : reachColor.argb();
    }
}

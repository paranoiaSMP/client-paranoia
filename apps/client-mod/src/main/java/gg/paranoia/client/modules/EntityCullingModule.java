package gg.paranoia.client.modules;

import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import gg.paranoia.client.module.SliderSetting;
import net.minecraft.entity.Entity;
import net.minecraft.entity.ExperienceOrbEntity;
import net.minecraft.entity.ItemEntity;
import net.minecraft.entity.LivingEntity;
import net.minecraft.entity.decoration.ArmorStandEntity;
import net.minecraft.entity.player.PlayerEntity;

/**
 * Cesse de dessiner le decor vivant dont on n'a que faire de loin.
 *
 * <p>Dans une base pleine d'objets au sol, ce ne sont pas les murs qui font
 * tomber le framerate: c'est le nombre. Chaque objet au sol tourne sur lui-meme
 * et se dessine entierement, chaque orbe d'experience aussi, et il en traine des
 * centaines apres n'importe quel combat. A quarante blocs, aucun d'eux ne
 * represente plus de trois pixels a l'ecran.
 *
 * <p><strong>Une regle ne se negocie pas: un joueur n'est jamais escamote.</strong>
 * Ni aucune creature vivante. En PvP, un adversaire qu'on ne voit pas parce que
 * le client a decide de l'economiser est le pire defaut possible -- pire que
 * n'importe quelle chute de framerate. Le module ne touche donc qu'a ce qui ne
 * rend jamais un coup: objets au sol, orbes d'experience, et les porte-armures
 * si on le lui demande explicitement.
 *
 * <p>Ce n'est que la moitie distance de l'occlusion. Ne pas dessiner ce qui est
 * cache derriere un mur viendra ensuite: cela demande un test de visibilite
 * reel, avec son propre cout et son propre risque, la ou celui-ci n'est qu'une
 * comparaison de distances.
 */
public final class EntityCullingModule extends Module {
    /** Le mixin s'execute dans le rendu: acces direct requis. */
    private static EntityCullingModule instance;

    private final SliderSetting itemDistance = add(new SliderSetting(
        "items", "Objets au sol au-dela de", 32, 8, 128, 4, " blocs"));

    private final SliderSetting orbDistance = add(new SliderSetting(
        "orbs", "Orbes d'experience au-dela de", 24, 8, 128, 4, " blocs"));

    /**
     * Les porte-armures sont exclus par defaut.
     *
     * <p>Ce sont des objets de decor sur la plupart des serveurs, mais des
     * reperes sur d'autres -- affichage de boutique, marqueur de zone, texte
     * flottant. Les faire disparaitre sans prevenir casserait ces usages.
     */
    private final BooleanSetting cullArmorStands = add(new BooleanSetting(
        "armorStands", "Inclure les porte-armures", false));

    private final SliderSetting armorStandDistance = add(new SliderSetting(
        "armorStandsDistance", "Porte-armures au-dela de", 48, 8, 128, 4, " blocs"));

    public EntityCullingModule() {
        super("entityCulling", "Alleger le decor lointain", ModuleCategory.VISUEL, false);
        instance = this;
    }

    /**
     * @param squaredDistance distance au carre entre la camera et l'entite.
     * @return true si cette entite peut etre passee pour cette image.
     */
    public static boolean shouldSkip(Entity entity, double squaredDistance) {
        EntityCullingModule module = instance;
        if (module == null || !module.enabled() || entity == null) {
            return false;
        }

        // La garde qui compte, et elle vient en premier: rien de vivant n'est
        // jamais escamote. `PlayerEntity` est redondant avec `LivingEntity`,
        // et c'est voulu -- si la hierarchie de Minecraft change un jour, le
        // joueur reste protege par son propre test.
        if (entity instanceof PlayerEntity || entity instanceof LivingEntity) {
            if (!(entity instanceof ArmorStandEntity)) {
                return false;
            }
            // Un porte-armure est un LivingEntity, mais il ne rend pas de coup.
            return module.cullArmorStands.get()
                && beyond(squaredDistance, module.armorStandDistance.getInt());
        }

        if (entity instanceof ExperienceOrbEntity) {
            return beyond(squaredDistance, module.orbDistance.getInt());
        }

        if (entity instanceof ItemEntity) {
            return beyond(squaredDistance, module.itemDistance.getInt());
        }

        return false;
    }

    private static boolean beyond(double squaredDistance, int blocks) {
        return squaredDistance > (double) blocks * blocks;
    }
}

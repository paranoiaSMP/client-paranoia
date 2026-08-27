package gg.paranoia.client.modules;

import gg.paranoia.client.diag.Rate;
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
 * <p>Deux raisons d'ecarter, cumulables: la distance, et l'occlusion -- un mur
 * entre la camera et l'entite. La seconde se regle a part et reste, elle aussi,
 * cantonnee aux memes categories.
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

    /**
     * Ne pas dessiner ce qui est derriere un mur.
     *
     * <p>Ne s'applique qu'aux memes categories que le reste du module -- objets
     * au sol, orbes, porte-armures -- et jamais aux joueurs ni aux creatures.
     * Ce n'est pas de la prudence de principe: le test tire un rayon et tient
     * pour opaque tout bloc qui l'arrete, verre et feuillage compris. Un joueur
     * derriere une vitre serait donc escamote alors qu'on le voit parfaitement.
     * Distinguer le verre d'un mur demande de lire l'opacite du bloc, une API
     * que la sonde n'a pas encore rendue; tant qu'elle manque, l'occlusion
     * reste cantonnee a ce dont la disparition ne coute rien.
     */
    private final BooleanSetting occlusion = add(new BooleanSetting(
        "occlusion", "Ignorer ce qui est derriere un mur", false));

    private final SliderSetting occlusionDistance = add(new SliderSetting(
        "occlusionDistance", "Occlusion au-dela de", 12, 4, 64, 2, " blocs"));

    /** Ce que le module a reellement ecarte, pour le panneau de diagnostic. */
    private final Rate skipped = new Rate();

    public static int skippedPerSecond() {
        EntityCullingModule module = instance;
        return module == null ? 0 : module.skipped.perSecond();
    }

    /** A appeler une fois par tick: ferme la fenetre de comptage. */
    public static void beginTick() {
        EntityCullingModule module = instance;
        if (module != null) {
            module.skipped.tick();
        }
        EntityVisibility.beginFrame();
    }

    public EntityCullingModule() {
        super("entityCulling", "Alleger le decor lointain", ModuleCategory.OPTIMISATION, false);
        instance = this;
    }

    /**
     * @param squaredDistance distance au carre entre la camera et l'entite.
     * @return true si cette entite peut etre passee pour cette image.
     */
    public static boolean shouldSkip(
        Entity entity, double squaredDistance, double cameraX, double cameraY, double cameraZ) {
        EntityCullingModule module = instance;
        if (module == null || !module.enabled() || entity == null) {
            return false;
        }

        // La categorie decide seule de ce qu'on a le droit d'ecarter: les deux
        // tests qui suivent ne s'appliquent qu'a ce qu'elle autorise.
        if (!culpable(module, entity)) {
            return false;
        }

        boolean skip = tooFar(module, entity, squaredDistance)
            || hidden(module, entity, squaredDistance, cameraX, cameraY, cameraZ);

        if (skip) {
            module.skipped.hit();
        }
        return skip;
    }

    /**
     * L'occlusion, quand elle est activee et que l'entite est assez loin.
     *
     * <p>Le seuil de distance n'est pas qu'une economie: tout pres, la camera
     * peut se trouver dans un bloc ou coller a un mur, et le rayon rapporterait
     * un contact qui n'a rien a voir avec ce que le joueur voit.
     */
    private static boolean hidden(
        EntityCullingModule module, Entity entity, double squaredDistance,
        double cameraX, double cameraY, double cameraZ) {
        if (!module.occlusion.get() || !beyond(squaredDistance, module.occlusionDistance.getInt())) {
            return false;
        }
        return !EntityVisibility.visible(entity, cameraX, cameraY, cameraZ);
    }

    /**
     * Cette entite peut-elle etre ecartee, quelle que soit la raison ?
     *
     * <p>La garde qui compte, et elle vient avant tout le reste: rien de vivant
     * n'est jamais escamote. {@code PlayerEntity} y figure alors que
     * {@code LivingEntity} suffirait, et c'est voulu -- si la hierarchie de
     * Minecraft change un jour, le joueur reste protege par son propre test.
     */
    private static boolean culpable(EntityCullingModule module, Entity entity) {
        if (entity instanceof PlayerEntity || entity instanceof LivingEntity) {
            // Un porte-armure est un LivingEntity, mais il ne rend pas de coup.
            return entity instanceof ArmorStandEntity && module.cullArmorStands.get();
        }
        return entity instanceof ExperienceOrbEntity || entity instanceof ItemEntity;
    }

    /** Le seuil de distance propre a la categorie. */
    private static boolean tooFar(EntityCullingModule module, Entity entity, double squaredDistance) {
        if (entity instanceof ArmorStandEntity) {
            return beyond(squaredDistance, module.armorStandDistance.getInt());
        }
        if (entity instanceof ExperienceOrbEntity) {
            return beyond(squaredDistance, module.orbDistance.getInt());
        }
        return beyond(squaredDistance, module.itemDistance.getInt());
    }

    private static boolean beyond(double squaredDistance, int blocks) {
        return squaredDistance > (double) blocks * blocks;
    }
}

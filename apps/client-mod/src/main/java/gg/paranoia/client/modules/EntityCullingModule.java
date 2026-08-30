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
 * <p><strong>Aucun etre vivant n'est jamais ecarte pour cause de distance.</strong>
 * En PvP, un adversaire qu'on ne voit pas parce que le client a decide de
 * l'economiser est le pire defaut possible -- pire que n'importe quelle chute
 * de framerate. La distance ne s'applique donc qu'a ce qui ne rend jamais un
 * coup: objets au sol, orbes d'experience, et les porte-armures si on le
 * demande explicitement.
 *
 * <p>L'occlusion -- un mur entre la camera et l'entite -- est le second motif,
 * et le seul qui puisse s'etendre aux joueurs. Cela demande un reglage separe,
 * desactive par defaut, et n'a de sens que parce que le test ne s'arrete qu'aux
 * cubes pleins et opaques: un adversaire derriere une vitre reste affiche. Le
 * detail des precautions est sur le reglage lui-meme.
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
     * Ne pas dessiner le decor situe derriere un mur.
     */
    private final BooleanSetting occlusion = add(new BooleanSetting(
        "occlusion", "Ignorer ce qui est derriere un mur", false));

    private final SliderSetting occlusionDistance = add(new SliderSetting(
        "occlusionDistance", "Occlusion au-dela de", 12, 4, 64, 2, " blocs"));

    /**
     * Etendre l'occlusion aux joueurs et aux creatures.
     *
     * <p>C'est le seul reglage du mod qui peut faire disparaitre un adversaire,
     * et il est donc le seul a etre entoure d'autant de precautions. Il ne
     * s'applique <strong>qu'a</strong> l'occlusion: aucune creature n'est jamais
     * ecartee pour cause de distance, quelle que soit la configuration.
     *
     * <p>Trois choses le rendent defendable:
     *
     * <ul>
     *   <li>le test ne s'arrete qu'aux cubes pleins et opaques -- une vitre, une
     *       trappe ou un feuillage ne cache personne;
     *   <li>la reponse n'est gardee qu'un tick, contre un quart de seconde pour
     *       le decor: un joueur qui sort d'un mur reapparait a l'image suivante,
     *       pas cinq ticks plus tard;
     *   <li>neuf rayons sont tires vers la boite entiere, et un seul qui passe
     *       suffit a garder l'adversaire affiche -- une epaule qui depasse le
     *       maintient visible.
     * </ul>
     *
     * <p>Desactive par defaut, et il doit le rester pour quiconque n'a pas
     * verifie le comportement sur son propre serveur. Un gain de framerate ne
     * vaut jamais un adversaire manque.
     */
    private final BooleanSetting occludeLiving = add(new BooleanSetting(
        "occludeLiving", "Inclure joueurs et creatures", false));

    /**
     * Distance minimale avant d'escamoter un etre vivant.
     *
     * <p>Plus haute que pour le decor, et pour une raison de combat: a bout
     * portant, la moindre erreur du test se paie immediatement. Au-dela de vingt
     * blocs, un adversaire entierement derriere un mur plein n'est pas en train
     * de porter un coup.
     */
    private final SliderSetting livingDistance = add(new SliderSetting(
        "livingDistance", "Joueurs et creatures au-dela de", 20, 8, 64, 2, " blocs"));

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
        EntityVisibility.beginTick();
    }

    public EntityCullingModule() {
        super("entityCulling", "Alleger le decor lointain", ModuleCategory.OPTIMISATION, false);
        instance = this;
    }

    /**
     * Le module a-t-il quelque chose a dire ?
     *
     * <p>A interroger avant tout calcul. Le mixin mesurait la distance de chaque
     * entite a la camera avant meme de savoir si le module etait actif -- et il
     * est desactive par defaut, donc tout le monde payait ce calcul pour rien.
     * C'est peu de chose par entite; ce n'est plus rien du tout quand on
     * n'allume jamais la fonction.
     */
    public static boolean active() {
        EntityCullingModule module = instance;
        return module != null && module.enabled();
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

        boolean skip = decide(module, entity, squaredDistance, cameraX, cameraY, cameraZ);
        if (skip) {
            module.skipped.hit();
        }
        return skip;
    }

    /**
     * Deux regimes, et la frontiere entre eux est la seule chose qui compte.
     *
     * <p>Ce qui rend des coups n'est jamais ecarte pour cause de distance --
     * seulement, et si on le lui demande, parce qu'un mur plein s'interpose. Le
     * decor, lui, releve des deux tests.
     */
    private static boolean decide(
        EntityCullingModule module, Entity entity, double squaredDistance,
        double cameraX, double cameraY, double cameraZ) {

        // Un porte-armure est un LivingEntity, mais il ne rend pas de coup: il
        // suit le regime du decor, et seulement si on l'a autorise.
        if (entity instanceof ArmorStandEntity) {
            return module.cullArmorStands.get()
                && (beyond(squaredDistance, module.armorStandDistance.getInt())
                    || hidden(module, entity, false, squaredDistance, module.occlusionDistance.getInt(),
                        cameraX, cameraY, cameraZ));
        }

        // PlayerEntity figure ici alors que LivingEntity suffirait, et c'est
        // voulu: si la hierarchie de Minecraft change un jour, le joueur reste
        // protege par son propre test.
        if (entity instanceof PlayerEntity || entity instanceof LivingEntity) {
            return module.occludeLiving.get()
                && hidden(module, entity, true, squaredDistance, module.livingDistance.getInt(),
                    cameraX, cameraY, cameraZ);
        }

        if (!(entity instanceof ExperienceOrbEntity || entity instanceof ItemEntity)) {
            return false;
        }

        return beyond(squaredDistance, entity instanceof ExperienceOrbEntity
                ? module.orbDistance.getInt()
                : module.itemDistance.getInt())
            || hidden(module, entity, false, squaredDistance, module.occlusionDistance.getInt(),
                cameraX, cameraY, cameraZ);
    }

    /**
     * L'occlusion, quand elle est activee et que l'entite est assez loin.
     *
     * <p>Le seuil de distance n'est pas qu'une economie: tout pres, la camera
     * peut se trouver dans un bloc ou coller a un mur, et le rayon rapporterait
     * un contact qui n'a rien a voir avec ce que le joueur voit.
     */
    private static boolean hidden(
        EntityCullingModule module, Entity entity, boolean living,
        double squaredDistance, int minimumBlocks,
        double cameraX, double cameraY, double cameraZ) {
        if (!module.occlusion.get() || !beyond(squaredDistance, minimumBlocks)) {
            return false;
        }
        return !EntityVisibility.visible(entity, living, cameraX, cameraY, cameraZ);
    }

    private static boolean beyond(double squaredDistance, int blocks) {
        return squaredDistance > (double) blocks * blocks;
    }
}

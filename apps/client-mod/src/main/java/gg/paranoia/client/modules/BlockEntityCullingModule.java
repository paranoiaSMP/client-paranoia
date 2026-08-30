package gg.paranoia.client.modules;

import gg.paranoia.client.diag.Rate;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import gg.paranoia.client.module.SliderSetting;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Vec3d;

/**
 * Raccourcit la portee des blocs animes.
 *
 * <p>Coffres, panneaux, bannieres, shulkers, enclumes de reparation: ceux-la ne
 * sont pas dessines avec le reste du terrain. Chacun a son propre rendu, appele
 * individuellement, avec son modele et ses matrices. Dans une base ou il y en a
 * trois cents, c'est une depense qui ne ressemble en rien a celle des blocs
 * ordinaires -- et elle se paie a chaque image.
 *
 * <p>Le jeu les ecarte deja au-dela de soixante-quatre blocs. Ce module ne fait
 * qu'abaisser ce seuil, ce qui est tout ce qu'on peut lui demander: a
 * trente-deux blocs, un panneau est illisible et une banniere est une tache.
 *
 * <p><strong>Ce qui a demande a etre vu de loin garde sa portee.</strong> Une
 * balise reclame deux cent cinquante-six blocs pour que son rayon reste visible
 * a l'autre bout de la carte; un portail de l'End, un conduit, ont leurs propres
 * exigences. Le module ne touche donc qu'aux rendus qui se contentent de la
 * portee ordinaire. Sans cette regle, abaisser le seuil aurait fait disparaitre
 * le rayon des balises -- un repere sur lequel des serveurs entiers sont batis.
 */
public final class BlockEntityCullingModule extends Module {
    /**
     * La portee que reclame un rendu qui n'a rien demande de particulier.
     *
     * <p>C'est la valeur par defaut de {@code getRenderDistance}. Tout ce qui
     * est au-dessus est un choix delibere du rendu, et on le respecte.
     */
    private static final int ORDINARY_DISTANCE = 64;

    /** Le mixin s'execute dans le rendu: acces direct requis. */
    private static BlockEntityCullingModule instance;

    private final SliderSetting distance = add(new SliderSetting(
        "distance", "Blocs animes au-dela de", 32, 8, 64, 4, " blocs"));

    /** Ce que le module a reellement ecarte, pour le panneau de diagnostic. */
    private final Rate skipped = new Rate();

    public static int skippedPerSecond() {
        BlockEntityCullingModule module = instance;
        return module == null ? 0 : module.skipped.perSecond();
    }

    /** A appeler une fois par tick: ferme la fenetre de comptage. */
    public static void beginTick() {
        BlockEntityCullingModule module = instance;
        if (module != null) {
            module.skipped.tick();
        }
    }

    public BlockEntityCullingModule() {
        super("blockEntityCulling", "Alleger les blocs animes", ModuleCategory.OPTIMISATION, false);
        instance = this;
    }

    /** Le module a-t-il quelque chose a dire ? A interroger avant tout calcul. */
    public static boolean active() {
        BlockEntityCullingModule module = instance;
        return module != null && module.enabled();
    }

    /**
     * @param vanillaDistance la portee que ce rendu reclame pour lui-meme.
     * @return true si ce bloc anime peut etre passe.
     */
    public static boolean shouldSkip(BlockEntity blockEntity, Vec3d camera, int vanillaDistance) {
        BlockEntityCullingModule module = instance;
        if (module == null || !module.enabled() || blockEntity == null || camera == null) {
            return false;
        }

        // La regle qui protege les balises, et elle vient avant le calcul.
        if (vanillaDistance > ORDINARY_DISTANCE) {
            return false;
        }

        int limit = module.distance.getInt();
        BlockPos pos = blockEntity.getPos();

        // Depuis le centre du bloc et non son coin: a la limite du seuil, l'ecart
        // d'un demi-bloc suffirait a faire clignoter un coffre quand on avance.
        double dx = pos.getX() + 0.5 - camera.x;
        double dy = pos.getY() + 0.5 - camera.y;
        double dz = pos.getZ() + 0.5 - camera.z;

        boolean skip = dx * dx + dy * dy + dz * dz > (double) limit * limit;
        if (skip) {
            module.skipped.hit();
        }
        return skip;
    }
}

package gg.paranoia.client.modules;

import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.Entity;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.RaycastContext;
import net.minecraft.world.World;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * L'entite est-elle visible, ou un bloc la cache-t-il ?
 *
 * <p>Un rayon part de la camera vers l'entite: s'il touche un bloc avant, elle
 * est cachee. C'est le principe, et tout le reste consiste a le rendre assez
 * bon marche pour que la question coute moins cher que la reponse.
 *
 * <p>Trois garde-fous pour ca:
 *
 * <ul>
 *   <li>le resultat est garde un quart de seconde par entite -- une entite
 *       cachee le reste generalement plus longtemps que trois images;
 *   <li>on s'arrete au premier rayon qui passe, et le centre est teste en
 *       premier: une entite bien visible coute donc un seul rayon;
 *   <li>un budget par image plafonne les nouveaux calculs; au-dela, on garde
 *       la reponse precedente plutot que de payer.
 * </ul>
 *
 * <p><strong>En cas de doute, on affiche.</strong> Une entite jamais testee, un
 * budget epuise, un monde absent: tous ces cas rendent « visible ». Le defaut
 * penche du cote ou l'on dessine quelque chose en trop, jamais du cote ou l'on
 * escamote quelque chose qu'il fallait voir.
 */
final class EntityVisibility {
    /** Duree de validite d'une reponse, en millisecondes. */
    private static final long CACHE_MILLIS = 250;

    /** Nouveaux calculs autorises par image. */
    private static final int BUDGET_PER_FRAME = 24;

    /** Au-dela, une entree n'a plus de porteur visible et encombre. */
    private static final long FORGET_MILLIS = 5_000;

    private static final Map<Integer, Entry> cache = new HashMap<>();

    private static int budget = BUDGET_PER_FRAME;
    private static long lastSweep = System.currentTimeMillis();

    private EntityVisibility() {
    }

    private static final class Entry {
        boolean visible = true;
        long checkedAt;
    }

    /** Ouvre une image: le budget de calculs est reconduit. */
    static void beginFrame() {
        budget = BUDGET_PER_FRAME;

        long now = System.currentTimeMillis();
        if (now - lastSweep < FORGET_MILLIS) {
            return;
        }
        lastSweep = now;

        // Les entites disparaissent sans prevenir -- mort, deconnexion,
        // eloignement. Sans ce balayage la table grossirait toute la partie.
        for (Iterator<Map.Entry<Integer, Entry>> it = cache.entrySet().iterator(); it.hasNext(); ) {
            if (now - it.next().getValue().checkedAt > FORGET_MILLIS) {
                it.remove();
            }
        }
    }

    /**
     * @return false uniquement si un bloc cache l'entite de facon certaine.
     */
    static boolean visible(Entity entity, double cameraX, double cameraY, double cameraZ) {
        MinecraftClient client = MinecraftClient.getInstance();
        World world = client == null ? null : client.world;
        if (world == null) {
            return true;
        }

        Entry entry = cache.get(entity.getId());
        long now = System.currentTimeMillis();

        if (entry != null && now - entry.checkedAt < CACHE_MILLIS) {
            return entry.visible;
        }

        // Budget epuise: on repond ce qu'on savait, sans recalculer. La reponse
        // vieillit d'une image, ce qui ne se voit pas.
        if (budget <= 0) {
            return entry == null || entry.visible;
        }
        budget--;

        if (entry == null) {
            entry = new Entry();
            cache.put(entity.getId(), entry);
        }

        entry.checkedAt = now;
        entry.visible = reachable(world, entity, new Vec3d(cameraX, cameraY, cameraZ));
        return entry.visible;
    }

    /**
     * Tire jusqu'a neuf rayons vers la boite de l'entite.
     *
     * <p>Le centre d'abord: une entite bien en vue coute alors un seul rayon,
     * et c'est le cas le plus frequent. Les huit coins ensuite, qui rattrapent
     * l'entite dont seule une extremite depasse d'un mur -- s'arreter au centre
     * l'aurait fait disparaitre alors qu'on en voit une partie.
     */
    private static boolean reachable(World world, Entity entity, Vec3d camera) {
        Box box = entity.getBoundingBox();

        if (clear(world, entity, camera, box.getCenter())) {
            return true;
        }

        // Les coins rentres d'un centieme: pile sur l'arete, le rayon frotte le
        // bloc voisin et rapporte un contact qui n'existe pas.
        double minX = box.minX + 0.01;
        double minY = box.minY + 0.01;
        double minZ = box.minZ + 0.01;
        double maxX = box.maxX - 0.01;
        double maxY = box.maxY - 0.01;
        double maxZ = box.maxZ - 0.01;

        for (int corner = 0; corner < 8; corner++) {
            Vec3d point = new Vec3d(
                (corner & 1) == 0 ? minX : maxX,
                (corner & 2) == 0 ? minY : maxY,
                (corner & 4) == 0 ? minZ : maxZ);
            if (clear(world, entity, camera, point)) {
                return true;
            }
        }
        return false;
    }

    private static boolean clear(World world, Entity entity, Vec3d from, Vec3d to) {
        // COLLIDER et non VISUAL: on veut savoir si un bloc plein s'interpose,
        // pas si une texture passe devant. NONE pour les fluides -- l'eau ne
        // cache pas ce qu'il y a derriere.
        HitResult hit = world.raycast(new RaycastContext(
            from, to, RaycastContext.ShapeType.COLLIDER, RaycastContext.FluidHandling.NONE, entity));
        return hit.getType() == HitResult.Type.MISS;
    }
}

package gg.paranoia.client.modules;

import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.Entity;
import net.minecraft.util.hit.HitResult;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.RaycastContext;
import net.minecraft.world.World;

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
 *   <li>un budget par tick plafonne les nouveaux calculs; au-dela, on garde
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

    /**
     * Nouveaux calculs autorises par tick.
     *
     * <p>Par tick et non par image, parce que c'est de la que vient l'appel --
     * le budget est reconduit depuis {@code START_CLIENT_TICK}. La difference
     * n'est pas cosmetique: le cout est ainsi plafonne a vingt-quatre calculs
     * vingt fois par seconde quelle que soit la fluidite, au lieu de grimper
     * avec elle. A cent vingt images par seconde, ces vingt-quatre calculs se
     * repartissent sur six images au lieu d'etre refaits a chaque fois.
     *
     * <p>Consequence a connaitre: au-dela d'environ cent vingt entites
     * candidates simultanees, toutes ne sont pas testees dans la duree de vie
     * d'une reponse, et les non testees restent affichees. L'allegement est
     * alors partiel -- jamais faux, seulement incomplet, ce qui est le bon sens
     * dans lequel se tromper. Les entites deja connues repondent sans consommer
     * de budget, donc celui-ci va naturellement aux inconnues et la couverture
     * s'etend d'un tick a l'autre.
     */
    private static final int BUDGET_PER_TICK = 24;

    /**
     * Nombre de cases du cache. Puissance de deux: le modulo devient un ET.
     *
     * <p>Deux mille personnes ou objets simultanement assez loin pour meriter
     * un test d'occlusion n'arrive pas; la table est donc dimensionnee pour
     * n'avoir en pratique jamais a arbitrer entre deux entites.
     */
    private static final int SLOTS = 2048;

    /**
     * Table a adressage direct, volontairement imparfaite.
     *
     * <p>Le premier jet utilisait une {@code HashMap<Integer, Entry>}. Elle
     * etait correcte et couteuse pour une raison invisible a la lecture: la cle
     * est un {@code int}, et {@code get} prend un {@code Object}. Chaque
     * consultation emballait donc l'identifiant dans un {@code Integer} neuf --
     * au-dela de 127, le cache de la JVM ne sert plus a rien. Une base pleine
     * d'objets au sol produisait des milliers d'objets jetables par seconde,
     * exactement dans le module cense en economiser.
     *
     * <p>Trois tableaux paralleles reglent ca: rien n'est alloue, la memoire est
     * bornee une fois pour toutes, et le balayage periodique qui empechait la
     * table de grossir toute la partie n'a plus de raison d'etre -- une entite
     * disparue laisse une case qui sera simplement reprise par la suivante.
     *
     * <p>Deux entites peuvent tomber sur la meme case. La perdante est alors
     * recalculee au prochain passage, ce qui est sans consequence: le budget par
     * tick plafonne deja ce travail, et la reponse rendue entre-temps est
     * « visible », le cote sur lequel on a le droit de se tromper.
     */
    private static final int[] slotEntity = new int[SLOTS];
    private static final long[] slotCheckedAt = new long[SLOTS];
    private static final boolean[] slotVisible = new boolean[SLOTS];

    private static int budget = BUDGET_PER_TICK;

    /**
     * La camera du tick en cours, reutilisee d'une entite a l'autre.
     *
     * <p>Elle ne bouge pas pendant une image, et {@code raycast} demande un
     * {@link Vec3d}: sans cette memoire, chaque entite testee en allouait un
     * identique au precedent.
     */
    private static Vec3d camera = Vec3d.ZERO;
    private static double cameraAtX = Double.NaN;
    private static double cameraAtY = Double.NaN;
    private static double cameraAtZ = Double.NaN;

    private EntityVisibility() {
    }

    /** Ouvre un tick: le budget de calculs est reconduit. */
    static void beginTick() {
        budget = BUDGET_PER_TICK;
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

        int id = entity.getId();
        int slot = slotOf(id);
        boolean mine = slotCheckedAt[slot] != 0 && slotEntity[slot] == id;
        long now = System.currentTimeMillis();

        if (mine && now - slotCheckedAt[slot] < CACHE_MILLIS) {
            return slotVisible[slot];
        }

        // Budget epuise: on repond ce qu'on savait, sans recalculer. La reponse
        // vieillit d'un tick, ce qui ne se voit pas. Si la case appartient a
        // une autre entite, on n'a rien appris sur celle-ci: elle est visible.
        if (budget <= 0) {
            return !mine || slotVisible[slot];
        }
        budget--;

        boolean answer = reachable(world, entity, camera(cameraX, cameraY, cameraZ));

        slotEntity[slot] = id;
        slotCheckedAt[slot] = now;
        slotVisible[slot] = answer;
        return answer;
    }

    /**
     * Disperse les identifiants voisins.
     *
     * <p>Les entites nees ensemble portent des identifiants consecutifs -- une
     * pile d'objets lachee a la mort d'un joueur, par exemple. Prendre les bits
     * de poids faible tels quels les rangerait cote a cote, ce qui n'est pas un
     * probleme ici; melanger les bits hauts evite en revanche que deux vagues
     * espacees de 2048 naissances se marchent systematiquement dessus.
     */
    private static int slotOf(int id) {
        return (id ^ (id >>> 16)) & (SLOTS - 1);
    }

    private static Vec3d camera(double x, double y, double z) {
        if (x != cameraAtX || y != cameraAtY || z != cameraAtZ) {
            cameraAtX = x;
            cameraAtY = y;
            cameraAtZ = z;
            camera = new Vec3d(x, y, z);
        }
        return camera;
    }

    /**
     * Tire jusqu'a neuf rayons vers la boite de l'entite.
     *
     * <p>Le centre d'abord: une entite bien en vue coute alors un seul rayon,
     * et c'est le cas le plus frequent. Les huit coins ensuite, qui rattrapent
     * l'entite dont seule une extremite depasse d'un mur -- s'arreter au centre
     * l'aurait fait disparaitre alors qu'on en voit une partie.
     */
    private static boolean reachable(World world, Entity entity, Vec3d from) {
        Box box = entity.getBoundingBox();

        if (clear(world, entity, from, box.getCenter())) {
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
            if (clear(world, entity, from, point)) {
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

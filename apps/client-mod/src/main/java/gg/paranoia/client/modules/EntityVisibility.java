package gg.paranoia.client.modules;

import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.Entity;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;
import net.minecraft.world.BlockView;
import net.minecraft.world.World;

import java.util.function.BiFunction;
import java.util.function.Function;

/**
 * L'entite est-elle visible, ou un bloc la cache-t-il ?
 *
 * <p>Un rayon part de la camera vers l'entite: s'il rencontre un cube plein et
 * opaque avant de l'atteindre, elle est cachee. C'est le principe, et tout le
 * reste consiste a le rendre assez bon marche pour que la question coute moins
 * cher que la reponse.
 *
 * <p>« Opaque » au sens strict, et c'est ce qui permet d'appliquer le test aux
 * joueurs: le verre, les feuillages, les dalles et les clotures ne cachent
 * personne et ne comptent pas.
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
    /** Duree de validite d'une reponse pour le decor, en millisecondes. */
    static final long DECOR_CACHE_MILLIS = 250;

    /**
     * Duree de validite pour ce qui rend des coups. Un tick, pas davantage.
     *
     * <p>C'est le chiffre le plus important du fichier. Un quart de seconde de
     * memoire sur un objet au sol ne se voit pas; la meme memoire sur un joueur
     * qui sort d'un mur, c'est cinq ticks pendant lesquels un adversaire bien
     * visible reste efface. En duel, ce defaut coute plus cher que tout ce que
     * l'allegement peut rapporter.
     *
     * <p>Cinquante millisecondes, donc: la reponse est refaite a chaque tick, et
     * le cache ne sert plus qu'a eviter de retirer les memes rayons plusieurs
     * fois dans la meme image quand le framerate depasse la cadence du jeu.
     */
    static final long LIVING_CACHE_MILLIS = 50;

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

    /**
     * Budget distinct pour ce qui rend des coups.
     *
     * <p>Separe, et pas seulement plus grand: si les joueurs puisaient dans le
     * meme budget que le decor, une base pleine d'objets au sol pourrait le
     * vider avant qu'un seul adversaire ait ete teste -- ou l'inverse. Les deux
     * populations n'ont ni la meme taille ni la meme urgence, elles ne se
     * disputent donc rien.
     *
     * <p>Trente-deux suffit largement: on compte les joueurs visibles par
     * dizaines, jamais par centaines.
     */
    private static final int LIVING_BUDGET_PER_TICK = 32;

    private static int budget = BUDGET_PER_TICK;
    private static int livingBudget = LIVING_BUDGET_PER_TICK;

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
        livingBudget = LIVING_BUDGET_PER_TICK;
    }

    /**
     * @param living true si l'entite rend des coups: memoire courte et budget
     *     a part. Voir {@link #LIVING_CACHE_MILLIS}.
     * @return false uniquement si un bloc cache l'entite de facon certaine.
     */
    static boolean visible(
        Entity entity, boolean living, double cameraX, double cameraY, double cameraZ) {
        MinecraftClient client = MinecraftClient.getInstance();
        World world = client == null ? null : client.world;
        if (world == null) {
            return true;
        }

        int id = entity.getId();
        int slot = slotOf(id);
        boolean mine = slotCheckedAt[slot] != 0 && slotEntity[slot] == id;
        long now = System.currentTimeMillis();

        if (mine && now - slotCheckedAt[slot] < (living ? LIVING_CACHE_MILLIS : DECOR_CACHE_MILLIS)) {
            return slotVisible[slot];
        }

        // Budget epuise: on repond ce qu'on savait, sans recalculer. La reponse
        // vieillit d'un tick, ce qui ne se voit pas. Si la case appartient a
        // une autre entite, on n'a rien appris sur celle-ci: elle est visible.
        if (living) {
            if (livingBudget <= 0) {
                return !mine || slotVisible[slot];
            }
            livingBudget--;
        } else {
            if (budget <= 0) {
                return !mine || slotVisible[slot];
            }
            budget--;
        }

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

        if (clear(world, from, box.getCenter())) {
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
            if (clear(world, from, point)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Un bloc reellement opaque s'interpose-t-il entre ces deux points ?
     *
     * <p>Le premier jet tirait un rayon de collision et tenait pour bouche tout
     * ce qui l'arretait. C'etait suffisant pour du decor, et inutilisable pour
     * un joueur: une vitre, une trappe, une feuille arretent le rayon sans rien
     * cacher, et l'adversaire qu'on voit parfaitement aurait disparu.
     *
     * <p>On parcourt donc les blocs traverses un par un et on ne s'arrete qu'au
     * premier cube plein et opaque. {@code isOpaqueFullCube} est exactement la
     * question posee: le bloc remplit-il son cube et la lumiere s'y arrete-t-elle.
     * Le verre, les feuillages, les dalles, les escaliers et les clotures
     * repondent non et laissent passer -- ce qui, pour une fois, est a la fois
     * plus correct et moins cher que la version precedente, qui allait chercher
     * la forme de collision de chaque bloc.
     *
     * <p>Un bloc dans un morceau non charge se lit comme de l'air: il ne bouche
     * pas. C'est le bon sens dans lequel se tromper.
     */
    private static boolean clear(World world, Vec3d from, Vec3d to) {
        Boolean blocked = BlockView.raycast(from, to, world, OPAQUE_STOP, MISS);
        return blocked == null || !blocked;
    }

    /**
     * Appele pour chaque bloc traverse; une reponse non nulle arrete le trajet.
     *
     * <p>Constantes et non lambdas construites a l'appel: elles ne capturent
     * rien -- le monde arrive par le parametre de contexte -- donc une seule
     * instance sert pour toute la partie.
     */
    private static final BiFunction<World, BlockPos, Boolean> OPAQUE_STOP =
        (world, pos) -> world.getBlockState(pos).isOpaqueFullCube() ? Boolean.TRUE : null;

    private static final Function<World, Boolean> MISS = world -> Boolean.FALSE;
}

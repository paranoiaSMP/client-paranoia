package gg.paranoia.client.modules;

import gg.paranoia.client.diag.Rate;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import gg.paranoia.client.module.SliderSetting;

/**
 * Plafonne le nombre de particules nees dans un meme tick.
 *
 * <p>Ce n'est pas « moins de particules ». Le jeu tient sans effort le flux
 * ordinaire -- pluie, fumee, pas de course. Ce qui le met a genoux, c'est la
 * rafale: une explosion de cristal fait naitre des centaines de particules dans
 * le meme tick, et c'est cette pointe, pas la moyenne, qui fait tomber le
 * framerate au moment precis ou le joueur en a besoin.
 *
 * <p>On refuse donc les naissances au-dela d'un plafond par tick, et on laisse
 * passer tout le reste. Le joueur garde son retour visuel -- les premieres
 * particules d'une explosion sont celles qu'il voit -- sans payer les
 * centaines suivantes qui se superposent au meme endroit.
 *
 * <p>Refuser la naissance plutot que le dessin est deliberement plus radical:
 * une particule non nee ne coute ensuite ni tick, ni collision, ni sommet.
 *
 * <p>Desactive par defaut. C'est un compromis visuel, et un compromis ne
 * s'impose pas: le joueur qui le veut va le chercher.
 */
public final class ParticleBudgetModule extends Module {
    /** Le mixin s'execute dans le chemin de naissance: acces direct requis. */
    private static ParticleBudgetModule instance;

    /**
     * Plafond par tick.
     *
     * <p>Deux cent cinquante-six laisse passer une explosion entiere de taille
     * ordinaire et n'ecrete que les rafales vraiment hors norme. Le curseur
     * descend jusqu'a trente-deux pour les configurations modestes.
     */
    private final SliderSetting perTick = add(new SliderSetting(
        "perTick", "Particules par tick", 256, 32, 2048, 32));

    /** Compteur du tick en cours. Fil de jeu uniquement. */
    private int spawned;

    /** Ce que le plafond a reellement ecarte, pour le panneau de diagnostic. */
    private final Rate dropped = new Rate();

    public static int droppedPerSecond() {
        ParticleBudgetModule module = instance;
        return module == null ? 0 : module.dropped.perSecond();
    }

    public ParticleBudgetModule() {
        super("particles", "Budget de particules", ModuleCategory.OPTIMISATION, false);
        instance = this;
    }

    /** Ouvre un nouveau tick: le budget est reconduit. */
    public static void beginTick() {
        ParticleBudgetModule module = instance;
        if (module != null) {
            module.spawned = 0;
            module.dropped.tick();
        }
    }

    /**
     * @return true si cette particule doit etre refusee.
     */
    public static boolean shouldDrop() {
        ParticleBudgetModule module = instance;
        if (module == null || !module.enabled()) {
            return false;
        }
        // Incremente meme au-dela du plafond: sans cela le compteur resterait
        // colle a la limite et le premier tick suivant repartirait fausse.
        boolean refuse = ++module.spawned > module.perTick.getInt();
        if (refuse) {
            module.dropped.hit();
        }
        return refuse;
    }
}

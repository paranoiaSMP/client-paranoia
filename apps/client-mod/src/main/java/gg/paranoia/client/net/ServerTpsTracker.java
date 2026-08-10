package gg.paranoia.client.net;

/**
 * Estimation du TPS du serveur.
 *
 * <p>Un client vanilla n'a pas acces au TPS: aucun paquet ne le transporte. La
 * seule mesure disponible est indirecte -- le serveur annonce periodiquement
 * l'heure du monde, et comparer deux annonces donne le nombre de ticks ecoules
 * par seconde reelle.
 *
 * <p>C'est donc une estimation, pas une mesure, et elle vaut ce que vaut son
 * hypothese: un serveur qui fige l'heure du monde (gamerule doDaylightCycle a
 * false, ou un plugin qui la pilote) rendra un chiffre faux. Dans ce cas on
 * prefere ne rien afficher plutot qu'un nombre invente.
 */
public final class ServerTpsTracker {
    /** En dessous, l'ecart est trop court pour etre significatif. */
    private static final long MIN_INTERVAL_MS = 500;

    /** Au-dela, on considere la mesure perimee (changement de serveur, lag). */
    private static final long STALE_AFTER_MS = 15_000;

    private static long lastTimestampMs;
    private static long lastWorldTime;
    private static double tps;
    private static long lastUpdateMs;

    private ServerTpsTracker() {
    }

    /** Appele par le mixin a chaque annonce d'heure du monde. */
    public static void onWorldTime(long worldTime) {
        long now = System.currentTimeMillis();

        if (lastTimestampMs == 0) {
            lastTimestampMs = now;
            lastWorldTime = worldTime;
            return;
        }

        long elapsedMs = now - lastTimestampMs;
        long ticks = worldTime - lastWorldTime;
        lastTimestampMs = now;
        lastWorldTime = worldTime;

        if (elapsedMs < MIN_INTERVAL_MS) {
            return;
        }

        // Heure figee ou remontee dans le passe (changement de monde, /time set):
        // l'ecart ne veut rien dire.
        if (ticks <= 0) {
            reset();
            return;
        }

        double measured = ticks * 1000.0 / elapsedMs;
        // Un serveur ne depasse pas 20 TPS; au-dela c'est un rattrapage apres
        // un a-coup, pas une vraie valeur.
        measured = Math.min(measured, 20.0);

        // Lissage: sans lui l'affichage saute a chaque annonce.
        tps = tps == 0 ? measured : tps * 0.7 + measured * 0.3;
        lastUpdateMs = now;
    }

    public static void reset() {
        lastTimestampMs = 0;
        lastWorldTime = 0;
        tps = 0;
        lastUpdateMs = 0;
    }

    /** TPS estime, ou -1 tant qu'aucune mesure fiable n'est disponible. */
    public static double tps() {
        if (tps <= 0 || System.currentTimeMillis() - lastUpdateMs > STALE_AFTER_MS) {
            return -1;
        }
        return tps;
    }
}

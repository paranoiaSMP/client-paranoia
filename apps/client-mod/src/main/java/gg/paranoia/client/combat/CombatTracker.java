package gg.paranoia.client.combat;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.util.hit.HitResult;

/**
 * Detecte les coups portes, pour la portee et le combo.
 *
 * <p>Sans injection: le coup se lit sur le compteur de recharge d'attaque, qui
 * retombe a zero au moment ou le joueur frappe. C'est une valeur que le mod
 * lisait deja -- la jauge de charge et le viseur s'en servent -- et dont la
 * sonde en CI confirme la signature sur toutes les versions ciblees. Une
 * injection sur {@code doAttack} aurait ete plus directe, et plus fragile: la
 * methode est privee, et son nom comme sa signature bougent d'une version a
 * l'autre.
 *
 * <p>Ce que cela mesure exactement, et ses limites: on releve la cible que le
 * jeu tenait sous le viseur a l'instant du coup. C'est ce que les autres
 * clients appellent la portee, et c'est la bonne mesure pour un HUD de combat.
 * Ce n'est pas une confirmation de degats -- le serveur seul en decide, et il
 * ne la renvoie pas. Un coup lance sur une cible qui s'ecarte au meme moment
 * sera compte.
 */
public final class CombatTracker {
    /**
     * Au-dela, le combo est retombe.
     *
     * <p>Quatre secondes: plus long qu'un enchainement, plus court qu'une
     * pause. Un compteur qui ne retombe jamais finit par afficher le total de
     * la partie, ce qui n'interesse personne au milieu d'un duel.
     */
    private static final long COMBO_TIMEOUT_MILLIS = 4000;

    /** En dessous, on considere que le joueur n'avait pas arme son coup. */
    private static final float SWING_THRESHOLD = 0.2f;

    private static float lastProgress = 1f;
    private static double lastReach;
    private static double bestReach;
    private static double totalReach;
    private static int reachSamples;
    private static int combo;
    private static int bestCombo;
    private static long lastHitAt;

    private CombatTracker() {
    }

    /** A appeler une fois par tick client, avant les modules qui lisent. */
    public static void tick() {
        MinecraftClient client = MinecraftClient.getInstance();
        ClientPlayerEntity player = client == null ? null : client.player;
        if (player == null) {
            reset();
            return;
        }

        long now = System.currentTimeMillis();
        if (combo > 0 && now - lastHitAt > COMBO_TIMEOUT_MILLIS) {
            combo = 0;
        }

        float progress = player.getAttackCooldownProgress(0f);
        boolean frappe = lastProgress > SWING_THRESHOLD && progress <= SWING_THRESHOLD;
        lastProgress = progress;

        if (!frappe || client.crosshairTarget == null
            || client.crosshairTarget.getType() != HitResult.Type.ENTITY) {
            return;
        }

        // La distance est prise entre les yeux du joueur et le point touche, et
        // non entre les deux centres: c'est de la que part le rai du jeu, donc
        // c'est la seule mesure qui corresponde a ce que la portee autorise.
        lastReach = player.getEyePos().distanceTo(client.crosshairTarget.getPos());
        bestReach = Math.max(bestReach, lastReach);
        totalReach += lastReach;
        reachSamples++;

        combo++;
        bestCombo = Math.max(bestCombo, combo);
        lastHitAt = now;
    }

    private static void reset() {
        lastProgress = 1f;
        combo = 0;
    }

    /** Remet les mesures a zero: a la demande du joueur, depuis les reglages. */
    public static void clear() {
        lastReach = 0;
        bestReach = 0;
        totalReach = 0;
        reachSamples = 0;
        combo = 0;
        bestCombo = 0;
    }

    public static double lastReach() {
        return lastReach;
    }

    public static double averageReach() {
        return reachSamples == 0 ? 0 : totalReach / reachSamples;
    }

    public static double bestReach() {
        return bestReach;
    }

    public static int combo() {
        return combo;
    }

    public static int bestCombo() {
        return bestCombo;
    }
}

package gg.paranoia.client.diag;

/**
 * Compteur d'evenements ramene a la seconde.
 *
 * <p>Deux champs et une comparaison de dates: on accumule, et chaque fois
 * qu'une seconde s'est ecoulee le total devient la valeur affichee. Pas de
 * moyenne glissante ni de fenetre -- un chiffre qui se rafraichit une fois par
 * seconde se lit, un chiffre qui bouge a chaque image ne se lit pas.
 *
 * <p>Fil du jeu uniquement. Les compteurs qui traversent les fils, comme celui
 * des requetes reseau, passent par un {@code AtomicInteger} avant d'arriver
 * ici.
 */
public final class Rate {
    private int accumulating;
    private int perSecond;
    private long windowStart = System.currentTimeMillis();

    /** Signale un evenement de plus dans la seconde en cours. */
    public void hit() {
        accumulating++;
    }

    public void hit(int count) {
        accumulating += count;
    }

    /** A appeler regulierement: ferme la fenetre quand la seconde est passee. */
    public void tick() {
        long now = System.currentTimeMillis();
        if (now - windowStart < 1000) {
            return;
        }
        windowStart = now;
        perSecond = accumulating;
        accumulating = 0;
    }

    /** Dernier total complet. Vaut zero pendant la premiere seconde. */
    public int perSecond() {
        return perSecond;
    }
}

package gg.paranoia.client.platform;

/**
 * Porte l'implementation fournie par le sous-projet de la version courante.
 *
 * <p>Pas de ServiceLoader ni de reflexion: le point d'entree declare dans
 * {@code fabric.mod.json} appartient au sous-projet de version, il connait donc
 * son implementation et l'installe avant de demarrer le code partage.
 */
public final class Platforms {
    private static ClientPlatform current;

    private Platforms() {
    }

    public static void install(ClientPlatform platform) {
        if (current != null) {
            throw new IllegalStateException("plateforme deja installee");
        }
        current = platform;
    }

    public static ClientPlatform get() {
        if (current == null) {
            // Arrive si du code partage s'execute avant le point d'entree de
            // version: mieux vaut le dire ici que de propager un NPE opaque.
            throw new IllegalStateException(
                "aucune plateforme installee: le point d'entree de version n'a pas ete appele");
        }
        return current;
    }
}

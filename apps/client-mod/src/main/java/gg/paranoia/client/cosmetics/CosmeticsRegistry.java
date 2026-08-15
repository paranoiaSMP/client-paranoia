package gg.paranoia.client.cosmetics;

import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Ce que portent les joueurs visibles, tel que l'API vient de le dire.
 *
 * <p>Rempli par le meme aller-retour reseau que les badges: demander les
 * cosmetiques separement doublerait le trafic pour une reponse qui concerne
 * exactement les memes joueurs.
 *
 * <p>Ne contient que des identifiants d'objets. Ce qu'ils valent -- nom,
 * texture, rarete -- vient du catalogue, qui change bien plus rarement et se
 * charge une fois pour toutes.
 */
public final class CosmeticsRegistry {
    /**
     * Ecrit d'un bloc par le fil reseau, lu par le rendu sans verrou.
     *
     * <p>Meme raison que pour les badges: un rendu qui verrouille sur une
     * structure ecrite par le reseau finit par saccader des que la connexion
     * ralentit.
     */
    private static volatile Map<UUID, List<String>> worn = Map.of();

    private CosmeticsRegistry() {
    }

    public static void apply(Map<UUID, List<String>> equipped) {
        worn = Map.copyOf(equipped);
    }

    /** Objets portes par ce joueur, vide s'il n'en a pas ou n'est pas connu. */
    public static List<String> equippedBy(UUID uuid) {
        if (uuid == null) {
            return List.of();
        }
        return worn.getOrDefault(uuid, List.of());
    }

    public static void clear() {
        worn = Map.of();
    }
}

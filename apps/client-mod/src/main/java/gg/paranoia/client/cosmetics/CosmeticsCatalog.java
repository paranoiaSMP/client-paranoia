package gg.paranoia.client.cosmetics;

import gg.paranoia.client.net.ParanoiaApi;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * A quoi ressemble chaque cosmetique.
 *
 * <p>Le lookup ne transporte que des identifiants d'objets -- « ce joueur porte
 * cape_uwu » -- parce que la meme poignee d'adresses de textures n'a aucune
 * raison de retransiter toutes les trente secondes. Le catalogue, lui, change
 * quelques fois par semaine et se charge une fois pour toutes.
 *
 * <p>Tous les types sont retenus, et non les seules capes. Le tri par type se
 * fait a la lecture, la ou l'on sait ce qu'on cherche: c'est ce qui permet
 * d'ajouter un type affichable sans retoucher le chargement, et c'est le seul
 * endroit ou l'on saurait encore quel type portait un objet une fois l'adresse
 * mise de cote.
 *
 * <p>Ce que cela coute est negligeable -- le catalogue tient en quelques
 * dizaines d'entrees -- et ce que cela evitait ne l'etait pas: tant que seules
 * les capes entraient ici, {@link #isEmpty()} rendait vrai pour un catalogue
 * qui n'en contenait aucune, et {@code PresenceService} le rechargeait a chaque
 * cycle sans jamais rien y trouver de plus.
 */
public final class CosmeticsCatalog {
    /** Ce que le catalogue dit d'un objet. */
    public record Item(String type, String textureUrl) {
    }

    /**
     * Identifiant d'objet vers ce que le catalogue en dit.
     *
     * <p>Ecrit d'un bloc par le fil reseau, lu par le rendu sans verrou: meme
     * regle que partout ailleurs ici.
     */
    private static volatile Map<String, Item> items = Map.of();

    private CosmeticsCatalog() {
    }

    public static void apply(List<ParanoiaApi.CatalogItem> catalogue) {
        Map<String, Item> parsed = new HashMap<>();
        for (ParanoiaApi.CatalogItem item : catalogue) {
            parsed.put(item.id(), new Item(item.type(), item.textureUrl()));
        }
        items = Map.copyOf(parsed);
    }

    /**
     * Adresse de la texture de cet objet, s'il existe et s'il est du type
     * demande. {@code null} sinon.
     *
     * <p>Le type est verifie et non suppose: un identifiant venu du lookup
     * designe un objet quelconque, et dessiner une texture de chapeau a
     * l'emplacement des ailes parce que le joueur porte les deux serait une
     * confusion silencieuse.
     */
    public static String textureOfType(String itemId, String type) {
        if (itemId == null || type == null) {
            return null;
        }
        Item item = items.get(itemId);
        return item != null && type.equals(item.type()) ? item.textureUrl() : null;
    }

    /** Adresse de la texture de cette cape, ou {@code null} si ce n'en est pas une. */
    public static String capeTexture(String itemId) {
        return textureOfType(itemId, "cape");
    }

    /** Adresse de la texture de ces ailes, ou {@code null} si ce n'en sont pas. */
    public static String wingsTexture(String itemId) {
        return textureOfType(itemId, "wings");
    }

    public static boolean isEmpty() {
        return items.isEmpty();
    }
}

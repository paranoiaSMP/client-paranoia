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
 * <p>Seules les capes sont retenues: c'est le seul type que le mod sache
 * afficher aujourd'hui. Garder les autres remplirait la memoire d'adresses que
 * rien ne demanderait jamais.
 */
public final class CosmeticsCatalog {
    /**
     * Identifiant d'objet vers adresse de texture, pour les capes uniquement.
     *
     * <p>Ecrit d'un bloc par le fil reseau, lu par le rendu sans verrou: meme
     * regle que partout ailleurs ici.
     */
    private static volatile Map<String, String> capes = Map.of();

    private CosmeticsCatalog() {
    }

    public static void apply(List<ParanoiaApi.CatalogItem> items) {
        Map<String, String> parsed = new HashMap<>();
        for (ParanoiaApi.CatalogItem item : items) {
            if ("cape".equals(item.type())) {
                parsed.put(item.id(), item.textureUrl());
            }
        }
        capes = Map.copyOf(parsed);
    }

    /** Adresse de la texture de cette cape, ou {@code null} si inconnue. */
    public static String capeTexture(String itemId) {
        return itemId == null ? null : capes.get(itemId);
    }

    public static boolean isEmpty() {
        return capes.isEmpty();
    }
}

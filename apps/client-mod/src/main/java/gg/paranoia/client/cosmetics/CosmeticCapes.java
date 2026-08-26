package gg.paranoia.client.cosmetics;

import net.minecraft.util.Identifier;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.BiFunction;

/**
 * Substitue la cape d'un joueur par celle qu'il porte chez nous.
 *
 * <p>On remplace la texture dans les donnees de peau plutot que de dessiner une
 * cape nous-memes. Le gain est enorme et il est gratuit: le jeu applique alors
 * a notre cape exactement la physique qu'il applique aux siennes -- l'ondulation
 * a la course, l'inclinaison au sprint, le repli en vol a l'elytre, la
 * disparition quand on s'accroupit. Redessiner tout cela a la main donnerait une
 * cape rigide qui trahirait immediatement le mod.
 *
 * <p>Le prix a payer est que {@code getSkinTextures()} est appele a chaque image
 * et pour chaque joueur visible. Reconstruire l'enregistrement a chaque appel
 * reviendrait a jeter un objet par joueur et par image, sur le fil de rendu et
 * en plein combat: c'est exactement ce qu'on vient de supprimer ailleurs. Le
 * resultat est donc garde tant que ni la peau ni la cape ne changent.
 */
public final class CosmeticCapes {
    /** Ce qu'on a construit pour un joueur, et ce dont cela decoulait. */
    private record Patched(Object source, Identifier cape, Object result) {
    }

    private static final Map<UUID, Patched> cache = new ConcurrentHashMap<>();

    private CosmeticCapes() {
    }

    /**
     * Texture de cape a porter, ou {@code null} pour laisser le jeu decider.
     *
     * <p>Un {@code null} veut dire « rien a substituer »: soit le joueur n'a pas
     * de cape chez nous, soit sa texture n'est pas encore telechargee. Dans les
     * deux cas le rendu d'origine s'applique, et la cape apparaitra d'elle-meme
     * a l'image suivante une fois la texture prete.
     */
    public static Identifier capeFor(UUID uuid) {
        List<String> worn = CosmeticsRegistry.equippedBy(uuid);
        if (worn.isEmpty()) {
            return null;
        }

        for (String item : worn) {
            String texture = CosmeticsCatalog.capeTexture(item);
            if (texture != null) {
                // Le premier trouve gagne: l'API n'autorise qu'un objet par
                // type, donc il ne peut y en avoir qu'un.
                return CosmeticTextures.get(texture);
            }
        }
        return null;
    }

    /**
     * Rend les donnees de peau, cape substituee si le joueur en porte une.
     *
     * <p>Generique parce que le type des donnees de peau differe selon la
     * version de Minecraft -- il a change de paquet, et son champ de cape est
     * passe d'un identifiant a un objet d'asset. Chaque version fournit donc sa
     * propre facon de reconstruire l'enregistrement; le cache, lui, est ecrit
     * une fois et vaut pour toutes.
     *
     * @param vanilla ce que le jeu allait renvoyer.
     * @param withCape reconstruit les donnees de peau avec la cape indiquee.
     */
    public static <T> T patched(UUID uuid, T vanilla, BiFunction<T, Identifier, T> withCape) {
        if (uuid == null || vanilla == null) {
            return vanilla;
        }

        Identifier cape = capeFor(uuid);
        if (cape == null) {
            // Rien a porter: on oublie l'entree plutot que de la garder, sinon
            // un joueur qui retire sa cape la traine jusqu'a sa deconnexion.
            cache.remove(uuid);
            return vanilla;
        }

        Patched known = cache.get(uuid);
        // Comparaison d'identite sur la source: le jeu memorise ses donnees de
        // peau et rend la meme instance tant qu'elles n'ont pas change, ce qui
        // fait de l'identite un test exact et immediat.
        if (known != null && known.source() == vanilla && known.cape().equals(cape)) {
            @SuppressWarnings("unchecked")
            T reused = (T) known.result();
            return reused;
        }

        T built = withCape.apply(vanilla, cape);
        cache.put(uuid, new Patched(vanilla, cape, built));
        return built;
    }

    /** Changement de serveur, ou fermeture. */
    public static void clear() {
        cache.clear();
    }
}

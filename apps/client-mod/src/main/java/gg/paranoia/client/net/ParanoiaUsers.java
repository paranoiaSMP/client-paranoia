package gg.paranoia.client.net;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

/**
 * Qui, parmi les joueurs connectes, utilise le client Paranoia.
 *
 * <p>Deux sources alimentent cette liste, et le badge s'affiche des que l'une
 * des deux repond.
 *
 * <p>L'API Paranoia est la source principale: le mod lui demande directement
 * le statut des joueurs qu'il voit. C'est ce qui fait marcher le badge sur
 * n'importe quel serveur, y compris ceux qui n'ont jamais entendu parler de
 * nous -- aucun serveur public n'installerait un plugin pour nos badges.
 *
 * <p>Un serveur peut malgre tout emettre la liste lui-meme via
 * {@link UsersPayload}. Cette source secondaire est conservee parce qu'elle ne
 * coute rien et qu'elle continue de fonctionner si l'API est injoignable, sur
 * les serveurs qui ont installe le plugin.
 *
 * <p>Ce que ce badge dit exactement: ce joueur s'est authentifie aupres de
 * l'API avec son compte Mojang, ou le serveur l'a declare. Pas davantage. Sur
 * un serveur hors ligne, ou pour un client modifie, la declaration serveur
 * reste declarative. C'est un signe de reconnaissance entre joueurs, pas une
 * preuve, et rien en jeu ne doit en dependre.
 */
public final class ParanoiaUsers {
    private static final Logger LOGGER = LoggerFactory.getLogger("ParanoiaClient/Users");

    /**
     * Lu par le rendu du tab et des etiquettes, ecrit par les fils reseau.
     *
     * <p>Volatiles et remplacees d'un bloc: le rendu ne verrouille rien et voit
     * soit l'ancienne liste, soit la nouvelle, jamais une liste a moitie
     * ecrite.
     *
     * <p>Deux champs plutot qu'un ensemble fusionne: les sources ont des
     * cycles de vie differents -- celle du serveur meurt avec la deconnexion,
     * celle de l'API survit d'un serveur a l'autre. Les melanger obligerait a
     * savoir quelle entree vient d'ou au moment de vider.
     */
    private static volatile Set<UUID> serverUsers = Set.of();
    private static volatile Set<UUID> apiUsers = Set.of();

    private ParanoiaUsers() {
    }

    public static boolean isUser(UUID uuid) {
        return uuid != null && (apiUsers.contains(uuid) || serverUsers.contains(uuid));
    }

    public static int count() {
        if (serverUsers.isEmpty()) {
            return apiUsers.size();
        }

        Set<UUID> union = new HashSet<>(apiUsers);
        union.addAll(serverUsers);
        return union.size();
    }

    /** Remplace la liste que l'API vient de confirmer. */
    public static void applyFromApi(Set<UUID> users) {
        apiUsers = Set.copyOf(users);
    }

    /** Remplace la liste par celle que le serveur annonce. */
    public static void apply(String json) {
        Set<UUID> parsed = parse(json);
        if (parsed == null) {
            // Charge utile illisible: on garde la liste precedente plutot que
            // de faire clignoter les badges sur une erreur de format.
            LOGGER.warn("Liste des utilisateurs illisible, ignoree");
            return;
        }

        serverUsers = parsed;
    }

    /**
     * Vide ce qui ne vaut que pour le serveur qu'on vient de quitter.
     *
     * <p>La liste de l'API n'est pas touchee: elle est reconstruite a chaque
     * interrogation a partir des joueurs reellement visibles, et la vider ici
     * ferait disparaitre tous les badges pendant un changement de monde.
     */
    public static void clear() {
        serverUsers = Set.of();
    }

    private static Set<UUID> parse(String json) {
        try {
            JsonElement root = JsonParser.parseString(json);
            if (!root.isJsonObject()) {
                return null;
            }

            JsonObject object = root.getAsJsonObject();
            if (!object.has("users") || !object.get("users").isJsonArray()) {
                return null;
            }

            JsonArray array = object.getAsJsonArray("users");
            Set<UUID> parsed = new HashSet<>();
            for (JsonElement element : array) {
                if (!element.isJsonPrimitive()) {
                    continue;
                }
                try {
                    parsed.add(UUID.fromString(element.getAsString()));
                } catch (IllegalArgumentException ignored) {
                    // Un identifiant mal forme ne doit pas jeter toute la liste.
                }
            }
            return Set.copyOf(parsed);
        } catch (RuntimeException err) {
            return null;
        }
    }
}

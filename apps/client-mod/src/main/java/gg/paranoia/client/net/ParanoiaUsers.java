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
 * <p>La liste est fournie par le serveur via {@link UsersPayload}. Sans serveur
 * qui l'emette, elle reste vide et aucun badge n'apparait -- ce qui est le
 * comportement voulu: afficher un badge par defaut reviendrait a affirmer
 * quelque chose qu'on ne sait pas.
 *
 * <p>Ce que ce badge dit exactement: le serveur a recu une declaration au nom
 * de ce joueur. Pas davantage. Un client modifie peut se declarer sans utiliser
 * Paranoia, comme il peut utiliser Paranoia sans se declarer. C'est un signe de
 * reconnaissance entre joueurs, pas une preuve.
 */
public final class ParanoiaUsers {
    private static final Logger LOGGER = LoggerFactory.getLogger("ParanoiaClient/Users");

    /**
     * Lu par le rendu du tab et des etiquettes, ecrit par le fil reseau.
     *
     * <p>Volatile et remplace d'un bloc: le rendu ne verrouille rien et voit
     * soit l'ancienne liste, soit la nouvelle, jamais une liste a moitie ecrite.
     */
    private static volatile Set<UUID> users = Set.of();

    private ParanoiaUsers() {
    }

    public static boolean isUser(UUID uuid) {
        return uuid != null && users.contains(uuid);
    }

    public static int count() {
        return users.size();
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

        users = parsed;
    }

    /** Vide la liste: elle ne vaut que pour le serveur qui l'a envoyee. */
    public static void clear() {
        users = Set.of();
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

package gg.paranoia.client.net;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import gg.paranoia.client.hud.HudRegistry;
import gg.paranoia.client.module.Module;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashSet;
import java.util.Set;

/**
 * Applique la politique d'un serveur aux modules.
 *
 * <p>Deux limites a garder en tete, parce qu'elles ne sont pas des details:
 *
 * <p>1. C'est de la cooperation, pas de l'anti-triche. Le client obeit parce
 * qu'il veut bien; un client modifie ignore le paquet. Empecher reellement un
 * module demande une detection cote serveur, qui est un autre chantier.
 *
 * <p>2. Aucun paquet ne veut dire aucune restriction. Un serveur qui n'est pas
 * un serveur Paranoia n'a rien a dire sur les modules, et le mod doit y rester
 * utilisable.
 */
public final class ModulePolicy {
    private static final Logger LOGGER = LoggerFactory.getLogger("ParanoiaClient/Policy");

    private ModulePolicy() {
    }

    /** Lit la politique et verrouille les modules qu'elle interdit. */
    public static void apply(HudRegistry registry, String json) {
        Set<String> blocked = parseBlocked(json);
        if (blocked == null) {
            // Charge utile illisible: on ne verrouille rien plutot que de
            // brider le joueur sur une erreur de format du serveur.
            LOGGER.warn("Politique serveur illisible, ignoree");
            return;
        }

        for (Module module : registry.all()) {
            module.setLockedByServer(blocked.contains(module.id()));
        }

        LOGGER.info("Politique serveur appliquee: {} module(s) interdit(s)", blocked.size());
    }

    /** Rend leur liberte a tous les modules, a la deconnexion. */
    public static void clear(HudRegistry registry) {
        for (Module module : registry.all()) {
            module.setLockedByServer(false);
        }
    }

    private static Set<String> parseBlocked(String json) {
        try {
            JsonElement root = JsonParser.parseString(json);
            if (!root.isJsonObject()) {
                return null;
            }

            JsonObject object = root.getAsJsonObject();
            JsonElement blocked = object.get("blocked");
            if (blocked == null) {
                // Champ absent: politique valide qui n'interdit rien.
                return Set.of();
            }
            if (!blocked.isJsonArray()) {
                return null;
            }

            Set<String> ids = new HashSet<>();
            JsonArray array = blocked.getAsJsonArray();
            for (JsonElement element : array) {
                if (element.isJsonPrimitive()) {
                    ids.add(element.getAsString());
                }
            }
            return ids;
        } catch (RuntimeException err) {
            return null;
        }
    }
}

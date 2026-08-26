package gg.paranoia.client.net;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Transport vers l'API Paranoia, et vers Mojang pour le handshake.
 *
 * <p>Cette classe ne fait que parler: aucune boucle, aucun etat, aucun jeton
 * conserve. {@link PresenceService} s'occupe du rythme et de la duree de vie.
 * La separation existe pour que la logique de session reste testable de tete,
 * sans avoir a suivre en meme temps des histoires de codes HTTP.
 *
 * <p>Toutes les methodes bloquent. Aucune ne doit etre appelee depuis le fil
 * de rendu: une requete reseau lente y gelerait le jeu.
 */
public final class ParanoiaApi {
    /**
     * Adresse par defaut, surchargeable par {@code -Dparanoia.api=...}.
     *
     * <p>La surcharge sert au developpement contre une API locale, et de
     * porte de sortie si le domaine devait changer avant qu'une nouvelle
     * version du mod soit publiee.
     */
    private static final String DEFAULT_BASE_URL = "https://api.paranoiastudio.fr";

    private static final String MOJANG_JOIN_URL =
        "https://sessionserver.mojang.com/session/minecraft/join";

    private final String baseUrl;
    private final HttpClient http;

    public ParanoiaApi() {
        String configured = System.getProperty("paranoia.api", DEFAULT_BASE_URL).trim();
        this.baseUrl = configured.endsWith("/")
            ? configured.substring(0, configured.length() - 1)
            : configured;

        this.http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            // Le jeu suit parfois des redirections d'un portail captif; les
            // suivre nous ferait interpreter sa page d'accueil comme une
            // reponse de l'API. On refuse, et l'erreur est alors lisible.
            .followRedirects(HttpClient.Redirect.NEVER)
            .build();
    }

    /** Reponse d'authentification: le jeton et sa duree de vie. */
    public record Token(String value, int expiresInSeconds) {
    }

    /** Reponse de lookup: qui est utilisateur, et que porte-t-il. */
    public record Lookup(Set<UUID> users, Map<UUID, List<String>> cosmetics) {
    }

    /**
     * Un objet du catalogue, reduit a ce dont le rendu a besoin.
     *
     * <p>Le lookup ne transporte que des identifiants d'objets: c'est le
     * catalogue qui dit a quoi ils ressemblent. La separation est voulue --
     * le catalogue change quelques fois par semaine, la liste des porteurs
     * a chaque cycle, et les melanger ferait retransiter les memes adresses
     * de textures toutes les trente secondes.
     */
    public record CatalogItem(String id, String type, String textureUrl) {
    }

    /** Echec cote serveur, avec le code pour distinguer un 401 du reste. */
    public static final class ApiException extends IOException {
        private final int status;

        ApiException(int status, String message) {
            super(message);
            this.status = status;
        }

        public int status() {
            return status;
        }

        /** Le jeton est mort: il faut refaire le handshake, pas abandonner. */
        public boolean requiresReauthentication() {
            return status == 401;
        }
    }

    /** Etape 1: obtenir un defi a presenter a Mojang. */
    public String beginChallenge() throws IOException, InterruptedException {
        JsonObject body = post("/v1/auth/begin", "{}", null);
        return string(body, "serverId");
    }

    /**
     * Etape 2: prouver a Mojang qu'on detient le compte.
     *
     * <p>Le meme appel que fait le jeu en rejoignant un serveur en ligne.
     * Mojang enregistre le couple (compte, serverId) pendant quelques
     * secondes, le temps que l'API vienne le verifier.
     *
     * <p>L'UUID part sans tirets: c'est la forme qu'attend cette route, et
     * l'envoyer avec ferait echouer la jointure sans message clair.
     */
    public void joinMojangSession(String accessToken, UUID profileId, String serverId)
        throws IOException, InterruptedException {
        JsonObject payload = new JsonObject();
        payload.addProperty("accessToken", accessToken);
        payload.addProperty("selectedProfile", profileId.toString().replace("-", ""));
        payload.addProperty("serverId", serverId);

        HttpResponse<String> response = send(
            request(URI.create(MOJANG_JOIN_URL))
                .header("content-type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(payload.toString()))
                .build());

        // 204 est le succes attendu. Mojang renvoie 403 quand le jeton d'acces
        // est perime, ce qui arrive en jeu hors ligne ou apres une tres longue
        // session.
        if (response.statusCode() != 204 && response.statusCode() != 200) {
            throw new ApiException(response.statusCode(), "Jointure Mojang refusee");
        }
    }

    /** Etape 3: echanger le defi verifie contre un jeton d'API. */
    public Token completeChallenge(String username, String serverId)
        throws IOException, InterruptedException {
        JsonObject payload = new JsonObject();
        payload.addProperty("username", username);
        payload.addProperty("serverId", serverId);

        JsonObject body = post("/v1/auth/complete", payload.toString(), null);
        return new Token(string(body, "token"), integer(body, "expiresIn", 43200));
    }

    /**
     * Signale que le joueur est toujours en jeu.
     *
     * @return l'intervalle, en secondes, avant le prochain signal. Le serveur
     *     le dicte pour pouvoir l'allonger sans republier le mod.
     */
    public int heartbeat(String token) throws IOException, InterruptedException {
        JsonObject body = post("/v1/presence/heartbeat", "{}", token);
        return integer(body, "intervalSeconds", 30);
    }

    /** Demande le statut des joueurs visibles, et rien de plus. */
    public Lookup lookup(String token, Collection<UUID> uuids)
        throws IOException, InterruptedException {
        JsonArray array = new JsonArray();
        for (UUID uuid : uuids) {
            array.add(uuid.toString());
        }

        JsonObject payload = new JsonObject();
        payload.add("uuids", array);

        JsonObject body = post("/v1/users/lookup", payload.toString(), token);
        return new Lookup(parseUsers(body), parseCosmetics(body));
    }

    /**
     * Catalogue des cosmetiques.
     *
     * <p>Sans jeton: c'est une vitrine publique, et la demander avant d'etre
     * authentifie permet d'avoir les textures pretes quand le premier porteur
     * apparait.
     */
    public List<CatalogItem> catalog() throws IOException, InterruptedException {
        HttpResponse<String> response =
            send(request(URI.create(baseUrl + "/v1/cosmetics/catalog")).GET().build());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new ApiException(response.statusCode(), "Catalogue indisponible");
        }

        JsonElement parsed = JsonParser.parseString(response.body());
        if (!parsed.isJsonArray()) {
            throw new ApiException(response.statusCode(), "Catalogue illisible");
        }

        List<CatalogItem> items = new ArrayList<>();
        for (JsonElement element : parsed.getAsJsonArray()) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject item = element.getAsJsonObject();

            String id = optional(item, "id");
            String type = optional(item, "type");
            // `textureUrl` est facultatif cote API: quand l'apercu et la texture
            // portee sont la meme image, seul `previewUrl` est renseigne.
            String texture = optional(item, "textureUrl");
            if (texture == null) {
                texture = optional(item, "previewUrl");
            }

            if (id != null && type != null && texture != null) {
                items.add(new CatalogItem(id, type, texture));
            }
        }
        return List.copyOf(items);
    }

    private static String optional(JsonObject body, String key) {
        JsonElement element = body.get(key);
        return element != null && element.isJsonPrimitive() ? element.getAsString() : null;
    }

    private static Set<UUID> parseUsers(JsonObject body) {
        if (!body.has("users") || !body.get("users").isJsonArray()) {
            return Set.of();
        }

        List<UUID> parsed = new ArrayList<>();
        for (JsonElement element : body.getAsJsonArray("users")) {
            UUID uuid = uuid(element);
            if (uuid != null) {
                parsed.add(uuid);
            }
        }
        return Set.copyOf(parsed);
    }

    private static Map<UUID, List<String>> parseCosmetics(JsonObject body) {
        if (!body.has("cosmetics") || !body.get("cosmetics").isJsonObject()) {
            return Map.of();
        }

        Map<UUID, List<String>> parsed = new HashMap<>();
        for (Map.Entry<String, JsonElement> entry : body.getAsJsonObject("cosmetics").entrySet()) {
            UUID uuid;
            try {
                uuid = UUID.fromString(entry.getKey());
            } catch (IllegalArgumentException ignored) {
                continue;
            }

            if (!entry.getValue().isJsonArray()) {
                continue;
            }

            List<String> worn = new ArrayList<>();
            for (JsonElement item : entry.getValue().getAsJsonArray()) {
                if (item.isJsonPrimitive()) {
                    worn.add(item.getAsString());
                }
            }

            if (!worn.isEmpty()) {
                parsed.put(uuid, List.copyOf(worn));
            }
        }
        return Map.copyOf(parsed);
    }

    private static UUID uuid(JsonElement element) {
        if (!element.isJsonPrimitive()) {
            return null;
        }
        try {
            return UUID.fromString(element.getAsString());
        } catch (IllegalArgumentException ignored) {
            // Un identifiant mal forme ne doit pas jeter toute la reponse.
            return null;
        }
    }

    private JsonObject post(String path, String body, String token)
        throws IOException, InterruptedException {
        HttpRequest.Builder builder = request(URI.create(baseUrl + path))
            .header("content-type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body));

        if (token != null) {
            builder.header("authorization", "Bearer " + token);
        }

        HttpResponse<String> response = send(builder.build());
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new ApiException(
                response.statusCode(), "Reponse " + response.statusCode() + " sur " + path);
        }

        JsonElement parsed = JsonParser.parseString(response.body());
        if (!parsed.isJsonObject()) {
            throw new ApiException(response.statusCode(), "Reponse illisible sur " + path);
        }
        return parsed.getAsJsonObject();
    }

    private HttpRequest.Builder request(URI uri) {
        return HttpRequest.newBuilder(uri)
            .timeout(Duration.ofSeconds(15))
            .header("accept", "application/json")
            .header("user-agent", "ParanoiaClient");
    }

    private HttpResponse<String> send(HttpRequest request)
        throws IOException, InterruptedException {
        return http.send(request, HttpResponse.BodyHandlers.ofString());
    }

    private static String string(JsonObject body, String key) throws ApiException {
        JsonElement element = body.get(key);
        if (element == null || !element.isJsonPrimitive()) {
            throw new ApiException(200, "Champ " + key + " absent de la reponse");
        }
        return element.getAsString();
    }

    private static int integer(JsonObject body, String key, int fallback) {
        JsonElement element = body.get(key);
        if (element == null || !element.isJsonPrimitive()) {
            return fallback;
        }
        try {
            return element.getAsInt();
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }
}

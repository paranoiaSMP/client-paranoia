package gg.paranoia.client.title;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Les comptes enregistres par le launcher, vus depuis le jeu.
 *
 * <p>Le launcher ecoute en local pendant qu'on joue -- c'est lui qui a lance
 * la partie -- et il sait quels comptes Microsoft sont connectes. Le jeu, lui,
 * ne connait que celui avec lequel il a demarre. Demander la liste permet a
 * l'ecran d'accueil de montrer les autres et d'en designer un pour la fois
 * suivante.
 *
 * <p>LA ROUTE INTERROGEE NE PORTE AUCUN SECRET, et c'est volontaire. Celle que
 * l'interface du launcher utilise rend les jetons -- celui de Minecraft,
 * vivant, et celui de renouvellement Microsoft, qui vaut un compte entier.
 * Ici on tourne dans un processus partage avec tous les mods que le joueur a
 * installes: on demande des pseudonymes, et on ne recoit que des pseudonymes.
 *
 * <p>Changer de compte ne change rien a la partie en cours: la session de
 * Minecraft est fixee au demarrage du jeu. C'est un choix enregistre, que le
 * launcher relira au prochain lancement.
 */
public final class Comptes {
    /** Doit rester aligne avec PORT dans apps/backend et le launcher. */
    private static final String BASE =
        System.getProperty("paranoia.launcher", "http://127.0.0.1:47820").trim();

    private static final Duration DELAI = Duration.ofSeconds(3);

    /** Un compte, reduit a ce qui s'affiche. */
    public record Compte(String id, String pseudonyme, boolean actif) {
    }

    /**
     * Resultat de la derniere interrogation.
     *
     * <p>{@code null} tant qu'aucune n'a abouti -- le launcher peut avoir ete
     * ferme apres le lancement, et c'est un cas normal, pas une panne.
     */
    private static volatile List<Compte> derniers;
    private static volatile boolean enCours;
    private static volatile long dernierEssai;

    private static final HttpClient HTTP = HttpClient.newBuilder()
        .connectTimeout(DELAI)
        // Meme raison que pour l'API: un portail captif qui repondrait a la
        // place du launcher ne doit pas etre pris pour lui.
        .followRedirects(HttpClient.Redirect.NEVER)
        .build();

    private Comptes() {
    }

    /** Ce qu'on sait, sans rien demander. Vide tant que rien n'a abouti. */
    public static List<Compte> connus() {
        List<Compte> liste = derniers;
        return liste == null ? List.of() : liste;
    }

    /**
     * Demande la liste, sans bloquer le rendu.
     *
     * <p>Appelee a l'ouverture de l'ecran, et pas a chaque image: trois
     * secondes entre deux essais suffisent, et un launcher ferme ne doit pas
     * couter un aller-retour par image.
     */
    public static void rafraichit() {
        long maintenant = System.currentTimeMillis();
        if (enCours || maintenant - dernierEssai < 3_000L) {
            return;
        }
        enCours = true;
        dernierEssai = maintenant;

        HttpRequest requete = HttpRequest.newBuilder(URI.create(BASE + "/v1/auth/accounts/summary"))
            .timeout(DELAI)
            .header("accept", "application/json")
            .GET()
            .build();

        CompletableFuture<HttpResponse<String>> envoi =
            HTTP.sendAsync(requete, HttpResponse.BodyHandlers.ofString());

        envoi.whenComplete((reponse, echec) -> {
            try {
                if (echec != null || reponse.statusCode() != 200) {
                    // Launcher ferme, ou plus vieux que cette route: on garde
                    // ce qu'on avait, et l'ecran n'affiche simplement rien.
                    return;
                }
                derniers = lis(reponse.body());
            } catch (RuntimeException err) {
                LoggerFactory.getLogger("ParanoiaClient")
                    .debug("[ACCUEIL] liste des comptes illisible: {}", err.getMessage());
            } finally {
                enCours = false;
            }
        });
    }

    /**
     * Designe le compte a utiliser au prochain lancement.
     *
     * <p>Sans attendre la reponse: l'ecran marque le choix tout de suite, et
     * le pire qui puisse arriver est que le launcher garde le precedent.
     */
    public static void choisit(String id) {
        // L'ecran affiche le nouveau choix sans attendre l'aller-retour.
        List<Compte> avant = derniers;
        if (avant != null) {
            List<Compte> apres = new ArrayList<>(avant.size());
            for (Compte compte : avant) {
                apres.add(new Compte(compte.id(), compte.pseudonyme(), compte.id().equals(id)));
            }
            derniers = List.copyOf(apres);
        }

        HttpRequest requete = HttpRequest.newBuilder(
                URI.create(BASE + "/v1/auth/accounts/" + id + "/active"))
            .timeout(DELAI)
            .method("PUT", HttpRequest.BodyPublishers.noBody())
            .build();

        HTTP.sendAsync(requete, HttpResponse.BodyHandlers.discarding())
            .exceptionally(echec -> null);
    }

    private static List<Compte> lis(String corps) {
        JsonElement racine = JsonParser.parseString(corps);
        if (!racine.isJsonArray()) {
            return List.of();
        }

        JsonArray tableau = racine.getAsJsonArray();
        List<Compte> comptes = new ArrayList<>(tableau.size());
        for (JsonElement element : tableau) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject objet = element.getAsJsonObject();
            if (!objet.has("id") || !objet.has("minecraftUsername")) {
                continue;
            }
            comptes.add(new Compte(
                objet.get("id").getAsString(),
                objet.get("minecraftUsername").getAsString(),
                objet.has("active") && objet.get("active").getAsBoolean()));
        }
        return List.copyOf(comptes);
    }
}

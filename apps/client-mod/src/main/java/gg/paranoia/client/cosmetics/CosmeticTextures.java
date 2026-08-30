package gg.paranoia.client.cosmetics;

import gg.paranoia.client.platform.Platforms;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.util.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.Iterator;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Une texture par image distincte, partagee par tous ceux qui la portent.
 *
 * <p>C'est la piece dont depend tout l'affichage des cosmetiques, et elle
 * existe pour une raison de memoire, pas de confort. Une cape en haute
 * definition -- 1024x256, ce que le format autorise -- pese un megaoctet en
 * memoire graphique une fois envoyee a la carte. Charger la meme cape une fois
 * par porteur, sur un serveur ou trente joueurs arborent la cape legendaire du
 * moment, revient a occuper trente megaoctets pour afficher trente fois la meme
 * image. Indexee par son adresse, elle n'est chargee qu'une fois.
 *
 * <p>La duree de vie ne se compte pas en references mais en usage. Un rendu ne
 * peut pas garantir des prises et des relachements apparies -- un joueur qui
 * quitte le serveur ne previent personne -- alors qu'il redemande sa texture a
 * chaque image tant qu'il l'affiche. Une entree que plus personne n'a reclamee
 * depuis une minute n'a donc plus de porteur visible, et sa memoire est rendue.
 *
 * <p>Trois fils se croisent ici, et la separation est stricte:
 *
 * <ul>
 *   <li>le fil de rendu appelle {@link #get} et n'y trouve qu'une lecture de
 *       champ: jamais d'attente, jamais de reseau;
 *   <li>un fil de fond telecharge et decode, parce qu'une image lente sur le
 *       fil de rendu gele le jeu;
 *   <li>l'envoi vers la carte graphique repasse par le fil de rendu, seul
 *       endroit ou un appel OpenGL est legal.
 * </ul>
 */
public final class CosmeticTextures {
    private static final Logger LOGGER = LoggerFactory.getLogger("ParanoiaClient/Textures");

    /**
     * Taille maximale d'un telechargement.
     *
     * <p>Quatre megaoctets laissent passer largement une cape 1024x512 en PNG,
     * et arretent un fichier qui n'aurait rien a faire la avant qu'il ne
     * remplisse la memoire.
     */
    private static final int MAX_BYTES = 4 * 1024 * 1024;

    /**
     * Plafond de definition, et donc de memoire graphique.
     *
     * <p>Le plafond precedent, 4096x2048, laissait passer trente-trois
     * megaoctets de memoire video par cosmetique une fois l'image decompressee.
     * Le plafond d'octets ne protege pas de ca: une image de couleurs plates se
     * compresse enormement, et quatre megaoctets de PNG peuvent en donner dix
     * fois plus une fois deplies.
     *
     * <p>Une cape vanilla mesure 64x32. A 2048x1024 on accepte encore
     * trente-deux fois cette definition dans chaque sens, ce qu'aucun
     * cosmetique legitime n'atteindra jamais -- mais le pire cas passe de
     * trente-trois a huit megaoctets. C'est un garde-fou contre une entree
     * malencontreuse du catalogue, pas une contrainte sur ce qu'on peut vendre.
     */
    private static final int MAX_PIXELS = 2048 * 1024;

    /** Delai sans demande au-dela duquel une texture est liberee. */
    private static final long UNUSED_TTL_MILLIS = 60_000;

    /** Delai avant de retenter une adresse qui a echoue. */
    private static final long RETRY_DELAY_MILLIS = 120_000;

    private static final Map<String, Entry> entries = new ConcurrentHashMap<>();

    private static final HttpClient HTTP = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(10))
        // Meme raison que pour l'API: la page d'un portail captif ne doit pas
        // etre interpretee comme une image.
        .followRedirects(HttpClient.Redirect.NEVER)
        .build();

    private static final ExecutorService WORKER = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "Paranoia/Textures");
        // Demon: fermer le jeu ne doit pas attendre la fin d'un telechargement.
        thread.setDaemon(true);
        return thread;
    });

    private CosmeticTextures() {
    }

    /** Une adresse, et ou en est son chargement. */
    private static final class Entry {
        /** Non nul des que la texture est utilisable. */
        volatile Identifier id;

        /** Derniere fois que quelqu'un l'a reclamee. */
        volatile long lastUsed = System.currentTimeMillis();

        /** Avant cette date, on ne retente pas apres un echec. */
        volatile long retryAfter;

        /** Empeche deux telechargements simultanes de la meme adresse. */
        final AtomicBoolean loading = new AtomicBoolean();
    }

    /**
     * Texture de cette adresse, ou {@code null} si elle n'est pas encore prete.
     *
     * <p>Ne bloque jamais. Un {@code null} veut dire « pas maintenant », pas
     * « jamais »: l'appelant retombe sur le rendu normal et redemandera a
     * l'image suivante. Le premier appel lance le telechargement.
     */
    public static Identifier get(String url) {
        if (url == null || url.isEmpty()) {
            return null;
        }

        Entry entry = entries.computeIfAbsent(url, key -> new Entry());
        long now = System.currentTimeMillis();
        entry.lastUsed = now;

        if (entry.id == null && now >= entry.retryAfter && entry.loading.compareAndSet(false, true)) {
            submit(url, entry);
        }

        return entry.id;
    }

    private static void submit(String url, Entry entry) {
        try {
            WORKER.execute(() -> load(url, entry));
        } catch (RejectedExecutionException ignored) {
            // Le jeu se ferme.
            entry.loading.set(false);
        }
    }

    /**
     * Libere les textures que plus personne n'affiche.
     *
     * <p>Appelee depuis le cycle de presence: c'est le seul battement regulier
     * qui continue quand plus aucun porteur n'est visible -- precisement le cas
     * ou il y a de la memoire a rendre.
     */
    public static void sweep() {
        long now = System.currentTimeMillis();

        for (Iterator<Map.Entry<String, Entry>> it = entries.entrySet().iterator(); it.hasNext(); ) {
            Entry entry = it.next().getValue();

            // Un telechargement en vol garde son entree: la retirer ferait
            // enregistrer une texture que plus rien ne connait, donc fuir.
            if (entry.loading.get() || now - entry.lastUsed < UNUSED_TTL_MILLIS) {
                continue;
            }

            Identifier id = entry.id;
            it.remove();
            if (id != null) {
                onRenderThread(() -> Platforms.get().unregisterCosmeticTexture(id));
            }
        }
    }

    /**
     * Textures reellement chargees sur la carte graphique.
     *
     * <p>C'est le chiffre qui prouve le partage: trente joueurs portant la meme
     * cape doivent en afficher une, pas trente.
     */
    public static int liveCount() {
        int live = 0;
        for (Entry entry : entries.values()) {
            if (entry.id != null) {
                live++;
            }
        }
        return live;
    }

    /** Tout liberer: changement de serveur, ou fermeture. */
    public static void clear() {
        for (Iterator<Map.Entry<String, Entry>> it = entries.entrySet().iterator(); it.hasNext(); ) {
            Identifier id = it.next().getValue().id;
            it.remove();
            if (id != null) {
                onRenderThread(() -> Platforms.get().unregisterCosmeticTexture(id));
            }
        }
    }

    // ---------------------------------------------------------- telechargement

    private static void load(String url, Entry entry) {
        try {
            NativeImage image = decode(url, download(url));
            onRenderThread(() -> publish(url, entry, image));
        } catch (InterruptedException err) {
            Thread.currentThread().interrupt();
            fail(entry, url, err);
        } catch (Exception err) {
            fail(entry, url, err);
        }
    }

    private static byte[] download(String url) throws IOException, InterruptedException {
        URI uri = URI.create(url);
        // Le catalogue vient de notre API, mais rien n'impose que son contenu
        // soit correct: une adresse en clair irait chercher une image sur un
        // reseau que le joueur ne controle pas.
        if (!"https".equalsIgnoreCase(uri.getScheme())) {
            throw new IOException("Adresse non securisee: " + url);
        }

        HttpResponse<byte[]> response = HTTP.send(
            HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(20))
                .header("accept", "image/png,image/*")
                .header("user-agent", "ParanoiaClient")
                .GET()
                .build(),
            HttpResponse.BodyHandlers.ofByteArray());

        if (response.statusCode() != 200) {
            throw new IOException("Reponse " + response.statusCode());
        }

        byte[] body = response.body();
        if (body.length > MAX_BYTES) {
            throw new IOException("Image trop lourde: " + body.length + " octets");
        }
        return body;
    }

    private static NativeImage decode(String url, byte[] body) throws IOException {
        NativeImage image = NativeImage.read(body);

        long pixels = (long) image.getWidth() * image.getHeight();
        if (pixels > MAX_PIXELS) {
            // Fermer avant de renoncer: l'image vit hors du tas Java, et la
            // laisser derriere soi serait une fuite que le ramasse-miettes ne
            // rattraperait pas.
            image.close();
            throw new IOException(
                "Image trop grande: " + image.getWidth() + "x" + image.getHeight());
        }

        LOGGER.debug("Texture chargee: {} ({}x{})", url, image.getWidth(), image.getHeight());
        return image;
    }

    /** Fil de rendu: enregistre l'image et rend l'entree utilisable. */
    private static void publish(String url, Entry entry, NativeImage image) {
        // Balayee entre-temps, ou deja publiee par un appel concurrent: dans
        // les deux cas l'image n'a plus de destinataire.
        if (entries.get(url) != entry || entry.id != null) {
            image.close();
            entry.loading.set(false);
            return;
        }

        try {
            entry.id = Platforms.get().registerCosmeticTexture(pathFor(url), image);
        } catch (RuntimeException err) {
            image.close();
            LOGGER.warn("Texture refusee par le jeu ({}): {}", url, err.getMessage());
            entry.retryAfter = System.currentTimeMillis() + RETRY_DELAY_MILLIS;
        } finally {
            entry.loading.set(false);
        }
    }

    private static void fail(Entry entry, String url, Exception err) {
        // Une seule ligne, en debug: une adresse morte dans le catalogue ne
        // doit pas remplir le journal du joueur a chaque tentative.
        LOGGER.debug("Texture indisponible ({}): {}", url, err.getMessage());
        entry.retryAfter = System.currentTimeMillis() + RETRY_DELAY_MILLIS;
        entry.loading.set(false);
    }

    // ------------------------------------------------------------------ outils

    private static void onRenderThread(Runnable action) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client == null) {
            return;
        }
        client.execute(action);
    }

    /**
     * Chemin de ressource derive de l'adresse.
     *
     * <p>Une empreinte plutot que l'adresse assainie: un identifiant Minecraft
     * n'accepte qu'un alphabet restreint, et deux adresses differentes ne
     * doivent jamais se reduire au meme chemin -- sans quoi une cape en
     * remplacerait une autre.
     */
    private static String pathFor(String url) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(url.getBytes(java.nio.charset.StandardCharsets.UTF_8));

            StringBuilder path = new StringBuilder("cosmetics/");
            for (int i = 0; i < 16; i++) {
                path.append(Character.forDigit((hash[i] >> 4) & 0xF, 16));
                path.append(Character.forDigit(hash[i] & 0xF, 16));
            }
            return path.toString();
        } catch (NoSuchAlgorithmException err) {
            // SHA-256 est exige de toute implementation Java.
            throw new IllegalStateException(err);
        }
    }
}

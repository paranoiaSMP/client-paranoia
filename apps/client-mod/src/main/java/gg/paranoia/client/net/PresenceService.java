package gg.paranoia.client.net;

import gg.paranoia.client.cosmetics.CosmeticsRegistry;
import gg.paranoia.client.platform.Platforms;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayNetworkHandler;
import net.minecraft.client.network.PlayerListEntry;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Tient l'API au courant, et lui demande qui porte quoi.
 *
 * <p>C'est ce qui permet au badge de fonctionner sur n'importe quel serveur.
 * La question -- « ce joueur utilise-t-il Paranoia ? » -- n'a pas de reponse
 * dans le protocole Minecraft: aucun paquet ne transporte quoi que ce soit sur
 * le logiciel du joueur d'en face. On la pose donc a un tiers que tous les
 * clients Paranoia partagent.
 *
 * <p>Deux fils cohabitent, et la frontiere entre eux est la regle a ne pas
 * enfreindre:
 *
 * <ul>
 *   <li>le fil du jeu echantillonne les joueurs visibles et la session, parce
 *       que les objets de Minecraft ne se lisent pas ailleurs sans risque;
 *   <li>un fil de fond fait le reseau, parce qu'une requete lente sur le fil
 *       de rendu gele le jeu.
 * </ul>
 *
 * <p>Les deux ne communiquent que par des champs {@code volatile}, jamais par
 * des appels croises.
 */
public final class PresenceService {
    private static final Logger LOGGER = LoggerFactory.getLogger("ParanoiaClient/Presence");

    /** Echantillonnage des joueurs visibles: deux fois par seconde suffit. */
    private static final int SAMPLE_INTERVAL_TICKS = 10;

    /** Premiere tentative peu apres l'arrivee en jeu, pas des le lancement. */
    private static final int INITIAL_DELAY_SECONDS = 5;

    private static final int MAX_BACKOFF_SECONDS = 600;

    private final ParanoiaApi api;
    private final ScheduledExecutorService worker;

    /** Ecrit par le fil du jeu, lu par le fil reseau. */
    private volatile Set<UUID> visible = Set.of();
    private volatile SessionInfo session;
    private volatile boolean inGame;

    private String token;
    private int interval = 30;
    private int consecutiveFailures;

    public PresenceService() {
        this(new ParanoiaApi());
    }

    PresenceService(ParanoiaApi api) {
        this.api = api;
        this.worker = Executors.newSingleThreadScheduledExecutor(runnable -> {
            Thread thread = new Thread(runnable, "Paranoia/Presence");
            // Demon: un joueur qui ferme le jeu ne doit pas attendre la fin
            // d'une requete en cours pour que le processus s'arrete.
            thread.setDaemon(true);
            return thread;
        });
    }

    public void start() {
        ClientTickEvents.END_CLIENT_TICK.register(this::sample);
        worker.schedule(this::cycle, INITIAL_DELAY_SECONDS, TimeUnit.SECONDS);
    }

    private int ticks;

    /**
     * Recopie, sur le fil du jeu, ce dont le fil reseau aura besoin.
     *
     * <p>Lire la liste des joueurs depuis le fil de fond marcherait la plupart
     * du temps et planterait le reste: cette collection est remplacee par le
     * fil du jeu a chaque changement de monde.
     */
    private void sample(MinecraftClient client) {
        if (client == null) {
            return;
        }

        if (session == null) {
            // `var` volontairement: le type de la session a change de paquet
            // entre les versions ciblees, et l'inference nous evite de le
            // nommer. Ses accesseurs, eux, sont identiques partout.
            var current = client.getSession();
            if (current != null) {
                session = new SessionInfo(
                    current.getUsername(), current.getUuidOrNull(), current.getAccessToken());
            }
        }

        // `world` plutot que `getNetworkHandler`: on ne veut compter comme
        // "en jeu" ni l'ecran de connexion, ni le temps de chargement.
        inGame = client.world != null;

        if (++ticks < SAMPLE_INTERVAL_TICKS) {
            return;
        }
        ticks = 0;

        ClientPlayNetworkHandler handler = client.getNetworkHandler();
        if (handler == null) {
            visible = Set.of();
            return;
        }

        Set<UUID> sampled = new HashSet<>();
        for (PlayerListEntry entry : handler.getPlayerList()) {
            UUID uuid = Platforms.get().profileId(entry);
            if (uuid != null) {
                sampled.add(uuid);
            }
        }
        visible = Set.copyOf(sampled);
    }

    /** Un aller-retour complet, puis reprogrammation du suivant. */
    private void cycle() {
        int nextDelay = interval;

        try {
            nextDelay = runOnce();
            consecutiveFailures = 0;
        } catch (InterruptedException err) {
            Thread.currentThread().interrupt();
            return;
        } catch (Exception err) {
            nextDelay = backoff(err);
        }

        try {
            worker.schedule(this::cycle, nextDelay, TimeUnit.SECONDS);
        } catch (java.util.concurrent.RejectedExecutionException ignored) {
            // Le jeu se ferme: plus rien a reprogrammer.
        }
    }

    private int runOnce() throws Exception {
        if (!inGame) {
            // Hors jeu, on ne signale rien: la presence veut dire "en train de
            // jouer", pas "launcher ouvert".
            return interval;
        }

        SessionInfo current = session;
        if (current == null || !current.usable()) {
            // Compte hors ligne ou session absente: rien a authentifier. On
            // reste silencieux plutot que d'essayer en boucle.
            return MAX_BACKOFF_SECONDS;
        }

        if (token == null) {
            token = authenticate(current);
        }

        try {
            interval = api.heartbeat(token);
            refreshUsers();
        } catch (ParanoiaApi.ApiException err) {
            if (!err.requiresReauthentication()) {
                throw err;
            }

            // Jeton expire ou service redemarre: on refait le handshake tout
            // de suite plutot que d'attendre le cycle suivant.
            LOGGER.debug("Jeton refuse, nouvelle authentification");
            token = authenticate(current);
            interval = api.heartbeat(token);
            refreshUsers();
        }

        return interval;
    }

    private String authenticate(SessionInfo current) throws Exception {
        String serverId = api.beginChallenge();
        api.joinMojangSession(current.accessToken(), current.profileId(), serverId);

        ParanoiaApi.Token issued = api.completeChallenge(current.username(), serverId);
        LOGGER.info("Authentifie aupres de l'API Paranoia");
        return issued.value();
    }

    private void refreshUsers() throws Exception {
        Set<UUID> asked = visible;
        if (asked.isEmpty()) {
            return;
        }

        ParanoiaApi.Lookup lookup = api.lookup(token, asked);
        ParanoiaUsers.applyFromApi(lookup.users());
        CosmeticsRegistry.apply(lookup.cosmetics());
    }

    /**
     * Espace les tentatives apres un echec.
     *
     * <p>Un service injoignable ne doit pas se traduire par une requete toutes
     * les trente secondes pendant toute la partie: c'est inutile pour le
     * joueur et hostile pour le serveur qui se remet en route.
     */
    private int backoff(Exception err) {
        consecutiveFailures++;

        if (err instanceof ParanoiaApi.ApiException api && api.requiresReauthentication()) {
            token = null;
        }

        // Un seul avertissement, puis on redescend en debug: repeter l'erreur
        // a chaque cycle noierait le journal du jeu.
        if (consecutiveFailures == 1) {
            LOGGER.warn("API Paranoia injoignable ({}), nouvelles tentatives espacees",
                err.getMessage());
        } else {
            LOGGER.debug("Echec {} aupres de l'API Paranoia", consecutiveFailures, err);
        }

        int delay = interval * (1 << Math.min(consecutiveFailures, 5));
        return Math.min(delay, MAX_BACKOFF_SECONDS);
    }
}

package gg.paranoia.server;

import org.bukkit.Bukkit;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.plugin.java.JavaPlugin;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Moitie serveur du client Paranoia.
 *
 * <p>Elle fait deux choses, et le client ne peut faire ni l'une ni l'autre tout
 * seul:
 *
 * <p>1. Elle dit a chaque client quels modules sont interdits ici.
 *
 * <p>2. Elle dit a chaque client qui, parmi les joueurs connectes, utilise
 * aussi le client Paranoia. Le protocole Minecraft ne transporte rien sur le
 * logiciel du joueur d'en face: seul le serveur, qui parle a tout le monde,
 * peut redistribuer cette information.
 *
 * <p>Ce n'est pas de l'anti-triche. Un client modifie ignore le paquet de
 * politique, et peut se declarer utilisateur sans l'etre. C'est de la
 * cooperation entre un serveur et des clients qui veulent bien jouer le jeu.
 */
public final class ParanoiaPlugin extends JavaPlugin implements Listener {
    private static final String POLICY_CHANNEL = "paranoia:policy";
    private static final String USERS_CHANNEL = "paranoia:users";

    /**
     * Delai avant d'envoyer quoi que ce soit a un joueur qui vient d'arriver.
     *
     * <p>Un client annonce les canaux qu'il sait recevoir juste apres la
     * connexion, pas pendant. Envoyer immediatement reviendrait a parler avant
     * que l'autre ait decroche: une seconde suffit, et le joueur ne voit rien.
     */
    private static final long JOIN_DELAY_TICKS = 20L;

    @Override
    public void onEnable() {
        saveDefaultConfig();

        getServer().getMessenger().registerOutgoingPluginChannel(this, POLICY_CHANNEL);
        getServer().getMessenger().registerOutgoingPluginChannel(this, USERS_CHANNEL);
        getServer().getPluginManager().registerEvents(this, this);

        getLogger().info("Paranoia: canaux " + POLICY_CHANNEL + " et " + USERS_CHANNEL + " ouverts");
    }

    @EventHandler
    public void onJoin(PlayerJoinEvent event) {
        Bukkit.getScheduler().runTaskLater(this, () -> {
            Player player = event.getPlayer();
            if (!player.isOnline()) {
                return;
            }

            if (usesParanoia(player)) {
                sendPolicy(player);
            }
            broadcastUsers();
        }, JOIN_DELAY_TICKS);
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        // Le joueur est encore dans la liste au moment de l'evenement: on
        // l'exclut explicitement plutot que d'attendre un tick.
        Bukkit.getScheduler().runTaskLater(this, this::broadcastUsers, 1L);
    }

    /**
     * Un joueur utilise-t-il le client Paranoia ?
     *
     * <p>On le lit dans les canaux que son client a annonces. Un client qui
     * embarque le mod enregistre ses recepteurs au demarrage, ce qui fait
     * remonter la declaration au serveur. Aucun paquet supplementaire n'est
     * necessaire, et un client vanilla n'apparait jamais par erreur.
     */
    private boolean usesParanoia(Player player) {
        return player.getListeningPluginChannels().contains(USERS_CHANNEL)
            || player.getListeningPluginChannels().contains(POLICY_CHANNEL);
    }

    private List<Player> paranoiaPlayers() {
        List<Player> users = new ArrayList<>();
        for (Player player : Bukkit.getOnlinePlayers()) {
            if (usesParanoia(player)) {
                users.add(player);
            }
        }
        return users;
    }

    /** Envoie a chaque utilisateur la liste complete, qui remplace la sienne. */
    private void broadcastUsers() {
        List<Player> users = paranoiaPlayers();
        if (users.isEmpty()) {
            return;
        }

        String json = "{\"users\":["
            + users.stream()
                .map(player -> "\"" + player.getUniqueId() + "\"")
                .collect(Collectors.joining(","))
            + "]}";

        byte[] payload = encode(json);
        for (Player player : users) {
            player.sendPluginMessage(this, USERS_CHANNEL, payload);
        }
    }

    /** Modules interdits ici, lus dans config.yml. */
    private void sendPolicy(Player player) {
        List<String> blocked = getConfig().getStringList("blocked");

        String json = "{\"blocked\":["
            + blocked.stream()
                .map(id -> "\"" + id + "\"")
                .collect(Collectors.joining(","))
            + "]}";

        player.sendPluginMessage(this, POLICY_CHANNEL, encode(json));
    }

    /**
     * Encode une chaine comme le protocole Minecraft l'attend.
     *
     * <p>Le client lit la charge utile avec {@code PacketCodecs.STRING}, qui
     * attend une longueur en VarInt suivie de l'UTF-8. Envoyer les octets bruts
     * du JSON donnerait un paquet que le client rejette en silence -- l'erreur
     * la plus facile a commettre ici, et la plus penible a diagnostiquer.
     */
    private static byte[] encode(String json) {
        byte[] utf8 = json.getBytes(StandardCharsets.UTF_8);
        ByteArrayOutputStream out = new ByteArrayOutputStream();

        int length = utf8.length;
        do {
            byte part = (byte) (length & 0b0111_1111);
            length >>>= 7;
            if (length != 0) {
                part |= (byte) 0b1000_0000;
            }
            out.write(part);
        } while (length != 0);

        out.writeBytes(utf8);
        return out.toByteArray();
    }
}

package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import gg.paranoia.client.net.ServerTpsTracker;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.item.ItemStack;

import java.util.ArrayList;
import java.util.List;

/**
 * Panneau d'informations: serveur, latence, armure, position, inventaire.
 *
 * <p>Chaque ligne s'active separement. Le TPS est une estimation, pas une
 * mesure: voir {@link ServerTpsTracker}. Tant qu'aucune valeur fiable n'est
 * disponible la ligne affiche "--" plutot qu'un chiffre invente.
 *
 * <p>C'etait le HUD le plus couteux du lot: sa liste de lignes se reconstruisait
 * six fois par image -- une fois pour savoir s'il fallait l'afficher, deux pour
 * la largeur, une pour la hauteur, deux au dessin -- et chacune de ces six fois
 * comptait les emplacements libres en parcourant les trente-six cases de
 * l'inventaire. Elle se construit maintenant une fois par image, et chaque
 * valeur n'est reformatee que lorsqu'elle change reellement.
 */
public final class InfoHud extends HudElement {
    private final BooleanSetting showIp = add(new BooleanSetting("ip", "Adresse du serveur", true));
    private final BooleanSetting showPing = add(new BooleanSetting("ping", "Latence", true));
    private final BooleanSetting showTps = add(new BooleanSetting("tps", "TPS (estime)", true));
    private final BooleanSetting showArmor = add(new BooleanSetting("armor", "Armure totale", true));
    private final BooleanSetting showCoords =
        add(new BooleanSetting("coords", "Coordonnees", false));
    private final BooleanSetting showInventory =
        add(new BooleanSetting("inventory", "Emplacements libres", true));
    private final ColorSetting labelColor =
        add(new ColorSetting("labelColor", "Couleur des libelles", 0xFF9090A0));
    private final ColorSetting valueColor =
        add(new ColorSetting("valueColor", "Couleur des valeurs", 0xFFFFFFFF));

    public InfoHud() {
        super("info", "Informations", false);
        placeAt(0.99, 0.02);
    }

    /** Une ligne = un libelle et une valeur, alignes en deux colonnes. */
    private static final class Line {
        String label = "";
        String value = "";
    }

    // Les lignes sont reutilisees d'une image a l'autre: leur nombre est borne
    // par le nombre de reglages, et seuls leurs textes changent.
    private final List<Line> pool = new ArrayList<>();
    private int count;

    // Valeurs affichees a l'image precedente. Un ping ou un nombre
    // d'emplacements libres se represente en un entier: le comparer coute
    // infiniment moins que de reconstruire la chaine qui en decoule.
    private String pingText = "--";
    private String tpsText = "--";
    private String armorText = "0";
    private String coordsText = "0 0 0";
    private String inventoryText = "0 libres";

    private int lastPing = Integer.MIN_VALUE;
    private int lastTpsTenths = Integer.MIN_VALUE;
    private int lastArmor = Integer.MIN_VALUE;
    private int lastX = Integer.MIN_VALUE;
    private int lastY = Integer.MIN_VALUE;
    private int lastZ = Integer.MIN_VALUE;
    private int lastFree = Integer.MIN_VALUE;

    @Override
    public boolean visibleInGame() {
        return client() != null && client().player != null && count > 0;
    }

    @Override
    protected void refresh() {
        count = 0;

        MinecraftClient client = client();
        if (client == null) {
            return;
        }
        ClientPlayerEntity player = client.player;

        // Pas de cache ici: `serverAddress` rend une chaine qui existe deja,
        // celle de l'entree du serveur ou une constante. Rien n'est construit.
        if (showIp.get()) {
            add("Serveur", serverAddress(client));
        }

        if (showPing.get()) {
            int ping = ping(client);
            if (ping != lastPing) {
                lastPing = ping;
                pingText = ping < 0 ? "--" : ping + " ms";
            }
            add("Ping", pingText);
        }

        if (showTps.get()) {
            // Arrondi au dixieme avant comparaison: c'est la precision affichee,
            // donc deux estimations qui ne different qu'au centieme donnent le
            // meme texte et n'ont aucune raison de le refaire.
            double tps = ServerTpsTracker.tps();
            int tenths = tps < 0 ? -1 : (int) Math.round(tps * 10);
            if (tenths != lastTpsTenths) {
                lastTpsTenths = tenths;
                tpsText = tenths < 0 ? "--" : (tenths / 10) + "." + (tenths % 10);
            }
            add("TPS", tpsText);
        }

        if (showArmor.get()) {
            int armor = player == null ? 0 : player.getArmor();
            if (armor != lastArmor) {
                lastArmor = armor;
                armorText = String.valueOf(armor);
            }
            add("Armure", armorText);
        }

        if (showCoords.get() && player != null) {
            int x = (int) Math.floor(player.getX());
            int y = (int) Math.floor(player.getY());
            int z = (int) Math.floor(player.getZ());
            if (x != lastX || y != lastY || z != lastZ) {
                lastX = x;
                lastY = y;
                lastZ = z;
                coordsText = x + " " + y + " " + z;
            }
            add("Position", coordsText);
        }

        if (showInventory.get() && player != null) {
            int free = freeSlots(player);
            if (free != lastFree) {
                lastFree = free;
                inventoryText = free + " libres";
            }
            add("Inventaire", inventoryText);
        }
    }

    private void add(String label, String value) {
        while (pool.size() <= count) {
            pool.add(new Line());
        }
        Line line = pool.get(count++);
        line.label = label;
        line.value = value;
    }

    private static String serverAddress(MinecraftClient client) {
        if (client.getCurrentServerEntry() != null) {
            return client.getCurrentServerEntry().address;
        }
        // Solo, ou monde ouvert au reseau local: dire "Solo" est plus utile
        // qu'une adresse vide.
        return client.isInSingleplayer() ? "Solo" : "--";
    }

    private static int ping(MinecraftClient client) {
        if (client.getNetworkHandler() == null || client.player == null) {
            return -1;
        }
        PlayerListEntry entry = client.getNetworkHandler().getPlayerListEntry(client.player.getUuid());
        return entry == null ? -1 : entry.getLatency();
    }

    /** Emplacements principaux encore vides, barre d'action comprise. */
    private static int freeSlots(ClientPlayerEntity player) {
        int free = 0;
        for (int slot = 0; slot < 36; slot++) {
            ItemStack stack = player.getInventory().getStack(slot);
            if (stack.isEmpty()) {
                free++;
            }
        }
        return free;
    }

    /** Largeur de la colonne des libelles: un parcours, aucune construction. */
    private int labelWidth(TextRenderer textRenderer) {
        int widest = 0;
        for (int index = 0; index < count; index++) {
            widest = Math.max(widest, textRenderer.getWidth(pool.get(index).label));
        }
        return widest;
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int widest = 0;
        int labels = labelWidth(textRenderer);
        for (int index = 0; index < count; index++) {
            widest = Math.max(widest, labels + 6 + textRenderer.getWidth(pool.get(index).value));
        }
        return widest + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return Math.max(1, count) * textRenderer.fontHeight + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        int labels = labelWidth(textRenderer);

        for (int index = 0; index < count; index++) {
            Line line = pool.get(index);
            int lineY = y + index * textRenderer.fontHeight;
            drawLine(context, textRenderer, line.label, x, lineY, labelColor.argb());
            drawLine(context, textRenderer, line.value, x + labels + 6, lineY, valueColor.argb());
        }
    }
}

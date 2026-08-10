package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
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
 * <p>Chaque ligne s'active separement. Le TPS est volontairement absent pour
 * l'instant: un client vanilla n'y a pas acces, il ne peut que l'estimer a
 * partir de l'intervalle entre deux paquets de temps du serveur, ce qui demande
 * un mixin. Il arrivera avec les autres modules qui en dependent, plutot que
 * sous forme d'un chiffre invente.
 */
public final class InfoHud extends HudElement {
    private final BooleanSetting showIp = add(new BooleanSetting("ip", "Adresse du serveur", true));
    private final BooleanSetting showPing = add(new BooleanSetting("ping", "Latence", true));
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

    @Override
    public boolean visibleInGame() {
        return client() != null && client().player != null && !lines().isEmpty();
    }

    /** Une ligne = un libelle et une valeur, alignes en deux colonnes. */
    private record Line(String label, String value) {
    }

    private List<Line> lines() {
        List<Line> lines = new ArrayList<>();
        MinecraftClient client = client();
        if (client == null) {
            return lines;
        }
        ClientPlayerEntity player = client.player;

        if (showIp.get()) {
            lines.add(new Line("Serveur", serverAddress(client)));
        }
        if (showPing.get()) {
            int ping = ping(client);
            lines.add(new Line("Ping", ping < 0 ? "--" : ping + " ms"));
        }
        if (showArmor.get()) {
            lines.add(new Line("Armure", player == null ? "0" : String.valueOf(player.getArmor())));
        }
        if (showCoords.get() && player != null) {
            lines.add(new Line("Position", (int) Math.floor(player.getX())
                + " " + (int) Math.floor(player.getY())
                + " " + (int) Math.floor(player.getZ())));
        }
        if (showInventory.get() && player != null) {
            lines.add(new Line("Inventaire", freeSlots(player) + " libres"));
        }

        return lines;
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

    private int labelWidth(TextRenderer textRenderer) {
        int widest = 0;
        for (Line line : lines()) {
            widest = Math.max(widest, textRenderer.getWidth(line.label()));
        }
        return widest;
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int widest = 0;
        int labels = labelWidth(textRenderer);
        for (Line line : lines()) {
            widest = Math.max(widest, labels + 6 + textRenderer.getWidth(line.value()));
        }
        return widest + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return Math.max(1, lines().size()) * textRenderer.fontHeight + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        List<Line> lines = lines();
        int labels = labelWidth(textRenderer);

        for (int i = 0; i < lines.size(); i++) {
            int lineY = y + i * textRenderer.fontHeight;
            drawLine(context, textRenderer, lines.get(i).label(), x, lineY, labelColor.argb());
            drawLine(context, textRenderer, lines.get(i).value(), x + labels + 6, lineY, valueColor.argb());
        }
    }
}

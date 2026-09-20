package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.PlayerListEntry;

/**
 * La latence vers le serveur, en millisecondes.
 *
 * <p>La valeur vient de la liste des joueurs -- celle qu'affiche la touche
 * Tab -- et non d'une mesure maison: c'est le meme chiffre que celui sur lequel
 * le jeu dessine ses barres de connexion, donc le joueur ne verra pas deux
 * nombres differents pour la meme chose. {@code InfoHud} le lit deja ainsi.
 *
 * <p>Elle n'existe qu'en multijoueur: en solo la liste ne contient pas
 * d'entree pour soi-meme, et l'element s'efface plutot que d'afficher un zero
 * qui passerait pour une latence parfaite.
 */
public final class PingHud extends HudElement {
    private final BooleanSetting colorByQuality =
        add(new BooleanSetting("quality", "Couleur selon la latence", true));
    private final ColorSetting color = add(new ColorSetting("color", "Couleur", 0xFFE9E9ED));

    public PingHud() {
        super("ping", "Ping", false);
        describe("Latence vers le serveur, telle que le jeu la mesure.");
        placeAt(0.01, 0.28);
    }

    private String value = "0";
    private int latency = -1;

    @Override
    public boolean visibleInGame() {
        return latency >= 0;
    }

    @Override
    protected void refresh() {
        int mesure = read();
        if (mesure == latency) {
            return;
        }
        latency = mesure;
        value = mesure < 0 ? "0" : String.valueOf(mesure);
    }

    private int read() {
        MinecraftClient client = client();
        if (client == null || client.player == null || client.getNetworkHandler() == null) {
            return -1;
        }
        PlayerListEntry entry =
            client.getNetworkHandler().getPlayerListEntry(client.player.getUuid());
        return entry == null ? -1 : entry.getLatency();
    }

    /**
     * Le ton suit la qualite de la connexion.
     *
     * <p>Les seuils sont ceux que le jeu emploie lui-meme pour ses barres:
     * en dessous de 150 la partie est confortable, au-dela de 300 elle ne
     * l'est plus. Reprendre d'autres bornes ferait dire deux choses
     * differentes a deux affichages de la meme mesure.
     */
    private int tone() {
        if (!colorByQuality.get() || latency < 0) {
            return color.argb();
        }
        if (latency < 150) {
            return 0xB5ABFC;
        }
        return latency < 300 ? 0xFFE07C : 0xFF7C7C;
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int head = heroWidth(textRenderer, value) + 3 + kickerWidth(textRenderer, "MS");
        return Math.max(head, kickerWidth(textRenderer, "PING")) + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return textRenderer.fontHeight + 2 + heroHeight(textRenderer) + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        drawKicker(context, textRenderer, "PING", x, y, 0x75798C);

        int valueY = y + textRenderer.fontHeight + 2;
        drawHero(context, textRenderer, value, x, valueY, tone());
        drawKicker(context, textRenderer, "MS",
            x + heroWidth(textRenderer, value) + 3,
            valueY + heroHeight(textRenderer) - textRenderer.fontHeight, 0x75798C);
    }
}

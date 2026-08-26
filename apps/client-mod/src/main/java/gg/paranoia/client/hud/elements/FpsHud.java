package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

/**
 * Images par seconde.
 *
 * <p>La valeur vient de {@code MinecraftClient.getCurrentFps()}, dont la sonde
 * en CI confirme la signature identique sur les versions ciblees: c'est le
 * meme compteur que celui de l'ecran F3, pas une mesure maison qui divergerait
 * de ce que le joueur voit ailleurs.
 */
public final class FpsHud extends HudElement {
    private final BooleanSetting showLabel = add(new BooleanSetting("label", "Afficher \"FPS\"", true));
    private final ColorSetting color = add(new ColorSetting("color", "Couleur", 0xFFFFFFFF));

    public FpsHud() {
        super("fps", "FPS", false);
        placeAt(0.01, 0.16);
    }

    // Le compteur du jeu ne bouge qu'une fois par seconde: formater ce nombre a
    // chaque image reviendrait a jeter deux cent trente-neuf chaines sur deux
    // cent quarante, toutes identiques.
    private String text = "0 FPS";
    private int lastFps = Integer.MIN_VALUE;
    private boolean lastLabel;

    @Override
    protected void refresh() {
        MinecraftClient client = client();
        int fps = client == null ? 0 : client.getCurrentFps();
        boolean labelNow = showLabel.get();

        if (fps == lastFps && labelNow == lastLabel) {
            return;
        }

        lastFps = fps;
        lastLabel = labelNow;
        text = labelNow ? fps + " FPS" : String.valueOf(fps);
    }

    @Override
    public int width(TextRenderer textRenderer) {
        return textRenderer.getWidth(text) + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return textRenderer.fontHeight + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        drawLine(context, textRenderer, text, x, y, color.argb());
    }
}

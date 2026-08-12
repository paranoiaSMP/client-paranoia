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

    private String text() {
        MinecraftClient client = client();
        int fps = client == null ? 0 : client.getCurrentFps();
        return showLabel.get() ? fps + " FPS" : String.valueOf(fps);
    }

    @Override
    public int width(TextRenderer textRenderer) {
        return textRenderer.getWidth(text()) + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return textRenderer.fontHeight + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        drawLine(context, textRenderer, text(), x, y, color.argb());
    }
}

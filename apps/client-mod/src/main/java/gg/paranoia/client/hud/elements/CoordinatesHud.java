package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;

/** Position du joueur, avec les coordonnees du Nether en option. */
public final class CoordinatesHud extends HudElement {
    private final BooleanSetting showNether =
        add(new BooleanSetting("nether", "Coordonnees Nether", false));
    private final BooleanSetting compact =
        add(new BooleanSetting("compact", "Affichage compact", true));
    private final ColorSetting color =
        add(new ColorSetting("color", "Couleur du texte", 0xFFFFFFFF));

    public CoordinatesHud() {
        super("coordinates", "Coordonnees", true);
        placeAt(0.01, 0.02);
    }

    @Override
    public boolean visibleInGame() {
        return client() != null && client().player != null;
    }

    private String[] lines() {
        ClientPlayerEntity player = client().player;
        if (player == null) {
            // Le menu peut s'ouvrir depuis l'ecran titre: on montre un exemple
            // plutot qu'un cadre vide impossible a positionner.
            return compact.get() ? new String[] {"0 / 64 / 0"} : new String[] {"X 0", "Y 64", "Z 0"};
        }

        int x = (int) Math.floor(player.getX());
        int y = (int) Math.floor(player.getY());
        int z = (int) Math.floor(player.getZ());

        if (compact.get()) {
            String main = x + " / " + y + " / " + z;
            return showNether.get()
                ? new String[] {main, "Nether " + (x / 8) + " / " + (z / 8)}
                : new String[] {main};
        }

        if (showNether.get()) {
            return new String[] {"X " + x, "Y " + y, "Z " + z, "Nether " + (x / 8) + " / " + (z / 8)};
        }
        return new String[] {"X " + x, "Y " + y, "Z " + z};
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int widest = 0;
        for (String line : lines()) {
            widest = Math.max(widest, textRenderer.getWidth(line));
        }
        return widest + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return lines().length * textRenderer.fontHeight + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        String[] lines = lines();
        for (int i = 0; i < lines.length; i++) {
            drawLine(context, textRenderer, lines[i], x, y + i * textRenderer.fontHeight, color.argb());
        }
    }
}

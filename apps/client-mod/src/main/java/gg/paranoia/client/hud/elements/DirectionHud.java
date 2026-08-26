package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.util.math.Direction;

/** Orientation du joueur, en toutes lettres et en axes. */
public final class DirectionHud extends HudElement {
    private final BooleanSetting showAxis =
        add(new BooleanSetting("axis", "Afficher les axes", true));
    private final ColorSetting color =
        add(new ColorSetting("color", "Couleur du texte", 0xFFFFFFFF));

    public DirectionHud() {
        super("direction", "Direction", true);
        placeAt(0.01, 0.09);
    }

    @Override
    public boolean visibleInGame() {
        return client() != null && client().player != null;
    }

    private static String label(Direction direction) {
        return switch (direction) {
            case NORTH -> "Nord";
            case SOUTH -> "Sud";
            case EAST -> "Est";
            case WEST -> "Ouest";
            default -> direction.name();
        };
    }

    /** Axes tels que les affiche le jeu en F3: utile pour s'orienter. */
    private static String axis(Direction direction) {
        return switch (direction) {
            case NORTH -> "-Z";
            case SOUTH -> "+Z";
            case EAST -> "+X";
            case WEST -> "-X";
            default -> "";
        };
    }

    // Un joueur regarde dans quatre directions: le texte ne peut prendre que
    // huit valeurs, et il en change beaucoup moins souvent qu'il n'y a d'images.
    private String text = label(Direction.NORTH);
    private Direction lastFacing;
    private boolean lastAxis;

    @Override
    protected void refresh() {
        ClientPlayerEntity player = client() == null ? null : client().player;
        Direction facing = player != null ? player.getHorizontalFacing() : Direction.NORTH;
        boolean axisNow = showAxis.get();

        if (facing == lastFacing && axisNow == lastAxis) {
            return;
        }

        lastFacing = facing;
        lastAxis = axisNow;

        String name = label(facing);
        text = axisNow ? name + " (" + axis(facing) + ")" : name;
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

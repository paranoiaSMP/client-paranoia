package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import org.lwjgl.glfw.GLFW;

import java.util.ArrayDeque;
import java.util.Deque;

/**
 * Clics par seconde, comptes sur la derniere seconde glissante.
 *
 * <p>Les boutons sont lus directement via GLFW, a chaque image et non a chaque
 * tick: a 20 ticks par seconde on manquerait des clics des qu'un joueur depasse
 * dix par seconde, ce qui est precisement la population qui regarde ce HUD.
 */
public final class CpsHud extends HudElement {
    private static final long WINDOW_MILLIS = 1000;

    private final BooleanSetting showLeft = add(new BooleanSetting("left", "Clic gauche", true));
    private final BooleanSetting showRight = add(new BooleanSetting("right", "Clic droit", false));
    private final ColorSetting color = add(new ColorSetting("color", "Couleur", 0xFFFFFFFF));

    private final Deque<Long> leftClicks = new ArrayDeque<>();
    private final Deque<Long> rightClicks = new ArrayDeque<>();

    private boolean leftDown;
    private boolean rightDown;

    public CpsHud() {
        super("cps", "CPS", false);
        placeAt(0.01, 0.22);
    }

    /**
     * Releve les fronts d'appui.
     *
     * <p>Appele a chaque image ou le HUD est affiche, et une seule fois par
     * image. Compter les clics quand personne ne les regarde n'aurait aucun
     * interet, et l'ecart de mesure ne se verrait pas.
     */
    private void poll() {
        MinecraftClient client = client();
        if (client == null || client.getWindow() == null) {
            return;
        }

        long handle = client.getWindow().getHandle();
        long now = System.currentTimeMillis();

        boolean left = GLFW.glfwGetMouseButton(handle, GLFW.GLFW_MOUSE_BUTTON_LEFT) == GLFW.GLFW_PRESS;
        if (left && !leftDown) {
            leftClicks.addLast(now);
        }
        leftDown = left;

        boolean right = GLFW.glfwGetMouseButton(handle, GLFW.GLFW_MOUSE_BUTTON_RIGHT) == GLFW.GLFW_PRESS;
        if (right && !rightDown) {
            rightClicks.addLast(now);
        }
        rightDown = right;

        expire(leftClicks, now);
        expire(rightClicks, now);
    }

    private static void expire(Deque<Long> clicks, long now) {
        while (!clicks.isEmpty() && now - clicks.peekFirst() > WINDOW_MILLIS) {
            clicks.removeFirst();
        }
    }

    // Le releve reste a chaque image -- c'est tout l'interet du module -- mais
    // le texte ne se refait que quand un compteur change de valeur.
    private String text = "0 CPS";
    private int lastLeft = Integer.MIN_VALUE;
    private int lastRight = Integer.MIN_VALUE;
    private boolean lastShowLeft;
    private boolean lastShowRight;

    @Override
    protected void refresh() {
        poll();

        int left = leftClicks.size();
        int right = rightClicks.size();
        boolean showLeftNow = showLeft.get();
        boolean showRightNow = showRight.get();

        if (left == lastLeft && right == lastRight
            && showLeftNow == lastShowLeft && showRightNow == lastShowRight) {
            return;
        }

        lastLeft = left;
        lastRight = right;
        lastShowLeft = showLeftNow;
        lastShowRight = showRightNow;

        if (showLeftNow && showRightNow) {
            text = left + " | " + right + " CPS";
        } else if (showRightNow) {
            text = right + " CPS";
        } else {
            text = left + " CPS";
        }
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

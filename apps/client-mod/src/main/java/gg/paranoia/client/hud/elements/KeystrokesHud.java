package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ModuleCategory;
import gg.paranoia.client.render.Shapes;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import org.lwjgl.glfw.GLFW;

import java.util.Locale;

/**
 * Les touches de deplacement et les clics, comme la grille de la maquette.
 *
 * <p>Les touches sont lues par leur <em>position physique</em> et non par leur
 * lettre: {@code GLFW_KEY_W} designe la touche qui porte un W sur un clavier
 * anglais, c'est-a-dire le Z d'un clavier francais. La grille tombe donc au bon
 * endroit quelle que soit la disposition, ce qu'un releve par lettre ne ferait
 * pas.
 *
 * <p>Les etiquettes, elles, viennent de {@code glfwGetKeyName}, qui rend le
 * caractere que la disposition courante grave sur cette touche. Un joueur en
 * AZERTY lit donc ZQSD, un joueur en QWERTY lit WASD, sans reglage.
 *
 * <p>GLFW plutot qu'un {@code KeyBinding}: son API ne bouge pas d'une version
 * du jeu a l'autre, alors que le constructeur de KeyBinding attend une
 * categorie sous forme de chaine en 1.21.8 et d'objet ensuite. Le mod lit deja
 * sa touche de menu de cette facon.
 */
public final class KeystrokesHud extends HudElement {
    /** Cote d'une touche et ecart entre deux, a l'echelle du jeu. */
    private static final int KEY = 20;
    private static final int GAP = 3;

    /** Une touche de la grille: sa position physique, sa colonne, sa rangee. */
    private record Key(int glfw, int column, int row, String fallback) {
    }

    /**
     * La croix de deplacement, puis la rangee des clics.
     *
     * <p>Les boutons de souris portent un code negatif: GLFW les numerote dans
     * un espace separe de celui des touches, et les melanger donnerait le
     * bouton gauche pour la barre d'espace.
     */
    private static final int MOUSE_LEFT = -1;
    private static final int MOUSE_RIGHT = -2;

    private static final Key[] KEYS = {
        new Key(GLFW.GLFW_KEY_W, 1, 0, "W"),
        new Key(GLFW.GLFW_KEY_A, 0, 1, "A"),
        new Key(GLFW.GLFW_KEY_S, 1, 1, "S"),
        new Key(GLFW.GLFW_KEY_D, 2, 1, "D"),
        new Key(MOUSE_LEFT, 0, 2, "LMB"),
        new Key(GLFW.GLFW_KEY_SPACE, 1, 2, "___"),
        new Key(MOUSE_RIGHT, 2, 2, "RMB"),
    };

    private final BooleanSetting showMouse =
        add(new BooleanSetting("mouse", "Inclure les clics", true));

    public KeystrokesHud() {
        super("keystrokes", "Touches", ModuleCategory.COMBAT, false);
        describe("Touches de deplacement et clics, en grille.");
        placeAt(0.01, 0.74);
    }

    private final boolean[] pressed = new boolean[KEYS.length];
    private final String[] labels = new String[KEYS.length];

    @Override
    protected void refresh() {
        MinecraftClient client = client();
        if (client == null || client.getWindow() == null) {
            return;
        }
        long handle = client.getWindow().getHandle();

        for (int index = 0; index < KEYS.length; index++) {
            Key key = KEYS[index];
            pressed[index] = key.glfw() < 0
                ? GLFW.glfwGetMouseButton(handle, bouton(key.glfw())) == GLFW.GLFW_PRESS
                : GLFW.glfwGetKey(handle, key.glfw()) == GLFW.GLFW_PRESS;

            if (labels[index] == null) {
                labels[index] = etiquette(key);
            }
        }
    }

    private static int bouton(int code) {
        return code == MOUSE_LEFT ? GLFW.GLFW_MOUSE_BUTTON_LEFT : GLFW.GLFW_MOUSE_BUTTON_RIGHT;
    }

    /**
     * Le caractere que la disposition courante grave sur cette touche.
     *
     * <p>{@code glfwGetKeyName} rend {@code null} pour tout ce qui n'est pas un
     * caractere imprimable -- la barre d'espace, notamment -- d'ou la valeur de
     * repli portee par chaque touche.
     */
    private static String etiquette(Key key) {
        if (key.glfw() < 0) {
            return key.fallback();
        }
        String nom = GLFW.glfwGetKeyName(key.glfw(), 0);
        return nom == null || nom.isBlank()
            ? key.fallback()
            : nom.toUpperCase(Locale.ROOT);
    }

    private int rows() {
        return showMouse.get() ? 3 : 2;
    }

    @Override
    public int width(TextRenderer textRenderer) {
        return 3 * KEY + 2 * GAP + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return rows() * KEY + (rows() - 1) * GAP + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        for (int index = 0; index < KEYS.length; index++) {
            Key key = KEYS[index];
            if (key.row() >= rows()) {
                continue;
            }

            int keyX = x + key.column() * (KEY + GAP);
            int keyY = y + key.row() * (KEY + GAP);
            boolean down = pressed[index];

            Shapes.rounded(context, keyX, keyY, KEY, KEY, 4,
                textColor(down ? 0x5D5294 : 0x161826));
            Shapes.roundedOutline(context, keyX, keyY, KEY, KEY, 4,
                textColor(down ? 0x9184D9 : 0x3F424D));

            String label = labels[index] == null ? key.fallback() : labels[index];
            int labelWidth = measure(textRenderer, label);
            drawLine(context, textRenderer, label,
                keyX + (KEY - labelWidth) / 2,
                keyY + (KEY - textRenderer.fontHeight) / 2,
                down ? 0xF5F4FF : 0x9397AB);
        }
    }
}

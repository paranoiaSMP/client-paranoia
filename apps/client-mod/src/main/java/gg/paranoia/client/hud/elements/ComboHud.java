package gg.paranoia.client.hud.elements;

import gg.paranoia.client.combat.CombatTracker;
import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import gg.paranoia.client.module.ModuleCategory;
import gg.paranoia.client.render.Shapes;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

/**
 * Le nombre de coups enchaines, avec la rangee de pastilles de la maquette.
 *
 * <p>Les pastilles disent la meme chose que le chiffre, et c'est voulu: en
 * combat on ne lit pas un nombre, on compte des points du coin de l'oeil. Le
 * chiffre est la pour apres.
 *
 * <p>Le combo retombe apres quatre secondes sans coup -- voir
 * {@link CombatTracker}. Un compteur qui ne retombe jamais finit par afficher
 * le total de la partie.
 */
public final class ComboHud extends HudElement {
    /** Autant que la maquette. Au-dela, le chiffre suffit. */
    private static final int DOTS = 8;

    private static final int DOT = 5;
    private static final int DOT_GAP = 2;

    private final BooleanSetting showDots =
        add(new BooleanSetting("dots", "Afficher les pastilles", true));
    private final ColorSetting color = add(new ColorSetting("color", "Couleur", 0xFFE9E9ED));

    public ComboHud() {
        super("combo", "Combo", ModuleCategory.COMBAT, false);
        describe("Coups enchaines, avec une rangee de pastilles.");
        placeAt(0.99, 0.18);
    }

    private String value = "0";
    private int lastCombo = Integer.MIN_VALUE;

    @Override
    protected void refresh() {
        int combo = CombatTracker.combo();
        if (combo != lastCombo) {
            lastCombo = combo;
            value = String.valueOf(combo);
        }
    }

    private int dotsWidth() {
        return DOTS * (DOT + DOT_GAP) - DOT_GAP;
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int head = Math.max(
            kickerWidth(textRenderer, "COMBO"),
            heroWidth(textRenderer, value) + 3 + kickerWidth(textRenderer, "HITS"));
        if (showDots.get()) {
            head = Math.max(head, dotsWidth());
        }
        return head + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        int total = textRenderer.fontHeight + 2 + heroHeight(textRenderer);
        if (showDots.get()) {
            total += 3 + DOT;
        }
        return total + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        drawKicker(context, textRenderer, "COMBO", x, y, 0x75798C);

        int valueY = y + textRenderer.fontHeight + 2;
        drawHero(context, textRenderer, value, x, valueY, color.argb());
        drawKicker(context, textRenderer, "HITS",
            x + heroWidth(textRenderer, value) + 3,
            valueY + heroHeight(textRenderer) - textRenderer.fontHeight, 0x75798C);

        if (!showDots.get()) {
            return;
        }

        // Au-dela de huit coups les pastilles restent pleines: elles comptent
        // jusqu'a huit, le chiffre compte au-dela.
        int allumees = Math.min(lastCombo, DOTS);
        int dotsY = valueY + heroHeight(textRenderer) + 3;
        for (int index = 0; index < DOTS; index++) {
            int dotX = x + index * (DOT + DOT_GAP);
            Shapes.rounded(context, dotX, dotsY, DOT, DOT, 1,
                textColor(index < allumees ? 0xB5ABFC : 0x3F424D));
        }
    }
}

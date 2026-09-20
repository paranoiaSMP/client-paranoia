package gg.paranoia.client.hud.elements;

import gg.paranoia.client.combat.CombatTracker;
import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import gg.paranoia.client.module.ModuleCategory;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

import java.util.Locale;

/**
 * La portee du dernier coup porte, en blocs.
 *
 * <p>La carte de la maquette: le libelle en kicker, la distance en grand avec
 * son unite, puis la moyenne et le maximum en sous-ligne. C'est un chiffre
 * qu'on regarde entre deux echanges, pas pendant -- d'ou la sous-ligne, qui
 * dit la tendance plutot que l'instant.
 *
 * <p>Ce que la mesure vaut exactement est explique dans
 * {@link CombatTracker}: elle releve la cible sous le viseur a l'instant du
 * coup, ce que les autres clients appellent la portee. Ce n'est pas une
 * confirmation de degats, que le serveur ne renvoie pas.
 */
public final class ReachHud extends HudElement {
    private final BooleanSetting showTrend =
        add(new BooleanSetting("trend", "Afficher moyenne et maximum", true));
    private final ColorSetting color = add(new ColorSetting("color", "Couleur", 0xFFE9E9ED));

    public ReachHud() {
        super("reach", "Portee", ModuleCategory.COMBAT, false);
        describe("Distance du dernier coup porte, avec moyenne et maximum.");
        placeAt(0.99, 0.02);
    }

    private String value = "0,0";
    private String trend = "";
    private double lastShown = -1;
    private double lastAverage = -1;
    private double lastBest = -1;

    @Override
    protected void refresh() {
        double reach = CombatTracker.lastReach();
        if (reach != lastShown) {
            lastShown = reach;
            value = format(reach);
        }

        double average = CombatTracker.averageReach();
        double best = CombatTracker.bestReach();
        if (average != lastAverage || best != lastBest) {
            lastAverage = average;
            lastBest = best;
            trend = best <= 0 ? "" : "MOY. " + format(average) + " · MAX " + format(best);
        }
    }

    /** Une decimale, virgule francaise: « 3,1 b » comme la maquette. */
    private static String format(double blocs) {
        return String.format(Locale.FRANCE, "%.1f", blocs);
    }

    private boolean trendVisible() {
        return showTrend.get() && !trend.isEmpty();
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int head = Math.max(
            kickerWidth(textRenderer, "REACH"),
            heroWidth(textRenderer, value) + 3 + kickerWidth(textRenderer, "B"));
        if (trendVisible()) {
            head = Math.max(head, kickerWidth(textRenderer, trend));
        }
        return head + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        int total = textRenderer.fontHeight + 2 + heroHeight(textRenderer);
        if (trendVisible()) {
            total += 2 + textRenderer.fontHeight;
        }
        return total + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        drawKicker(context, textRenderer, "REACH", x, y, 0x75798C);

        int valueY = y + textRenderer.fontHeight + 2;
        drawHero(context, textRenderer, value, x, valueY, color.argb());
        drawKicker(context, textRenderer, "B",
            x + heroWidth(textRenderer, value) + 3,
            valueY + heroHeight(textRenderer) - textRenderer.fontHeight, 0x75798C);

        if (trendVisible()) {
            drawKicker(context, textRenderer, trend, x,
                valueY + heroHeight(textRenderer) + 2, 0x9397AB);
        }
    }
}

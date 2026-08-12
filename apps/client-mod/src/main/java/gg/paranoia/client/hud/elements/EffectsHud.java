package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.entity.effect.StatusEffectInstance;

import java.util.ArrayList;
import java.util.List;

/**
 * Effets de potion actifs, avec leur niveau et le temps restant.
 *
 * <p>Le nom vient du jeu ({@code StatusEffect.getName()}), pas d'une table
 * maison: il suit donc la langue choisie par le joueur et n'a pas a etre tenu a
 * jour a chaque effet ajoute par Mojang.
 */
public final class EffectsHud extends HudElement {
    /** Chiffres romains jusqu'au niveau que le jeu produit reellement. */
    private static final String[] LEVELS = {"", "II", "III", "IV", "V", "VI", "VII", "VIII"};

    private final BooleanSetting showDuration =
        add(new BooleanSetting("duration", "Temps restant", true));
    private final BooleanSetting hideAmbient =
        add(new BooleanSetting("hideAmbient", "Masquer les effets de balise", false));
    private final ColorSetting nameColor = add(new ColorSetting("nameColor", "Couleur du nom", 0xFFFFFFFF));
    private final ColorSetting timeColor =
        add(new ColorSetting("timeColor", "Couleur du temps", 0xFF9090A0));

    public EffectsHud() {
        super("effects", "Effets", false);
        placeAt(0.01, 0.5);
    }

    @Override
    public boolean visibleInGame() {
        return !entries().isEmpty();
    }

    /** Une ligne = le nom de l'effet et son temps restant. */
    private record Entry(String name, String time) {
    }

    private List<Entry> entries() {
        List<Entry> entries = new ArrayList<>();
        ClientPlayerEntity player = client() == null ? null : client().player;
        if (player == null) {
            return entries;
        }

        for (StatusEffectInstance instance : player.getStatusEffects()) {
            if (hideAmbient.get() && instance.isAmbient()) {
                continue;
            }

            String name = instance.getEffectType().value().getName().getString();
            int amplifier = instance.getAmplifier();
            if (amplifier > 0 && amplifier < LEVELS.length) {
                name = name + " " + LEVELS[amplifier];
            }

            entries.add(new Entry(name, showDuration.get() ? formatDuration(instance) : ""));
        }
        return entries;
    }

    /**
     * Temps restant en m:ss.
     *
     * <p>Une duree negative signale un effet sans fin (balise de conduit, mode
     * creatif): afficher un compte a rebours y serait faux.
     */
    private static String formatDuration(StatusEffectInstance instance) {
        int ticks = instance.getDuration();
        if (ticks < 0) {
            return "--";
        }

        int seconds = ticks / 20;
        return (seconds / 60) + ":" + String.format("%02d", seconds % 60);
    }

    private int nameWidth(TextRenderer textRenderer) {
        int widest = 0;
        for (Entry entry : entries()) {
            widest = Math.max(widest, textRenderer.getWidth(entry.name()));
        }
        return widest;
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int widest = 0;
        int names = nameWidth(textRenderer);
        for (Entry entry : entries()) {
            int time = entry.time().isEmpty() ? 0 : textRenderer.getWidth(entry.time()) + 6;
            widest = Math.max(widest, names + time);
        }
        return widest + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return Math.max(1, entries().size()) * textRenderer.fontHeight + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        List<Entry> entries = entries();
        int names = nameWidth(textRenderer);

        for (int index = 0; index < entries.size(); index++) {
            int lineY = y + index * textRenderer.fontHeight;
            drawLine(context, textRenderer, entries.get(index).name(), x, lineY, nameColor.argb());

            String time = entries.get(index).time();
            if (!time.isEmpty()) {
                drawLine(context, textRenderer, time, x + names + 6, lineY, timeColor.argb());
            }
        }
    }
}

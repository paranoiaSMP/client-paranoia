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

    /**
     * Une ligne, reutilisee d'une image a l'autre.
     *
     * <p>Mutable, contrairement au record qu'elle remplace: le nom d'un effet
     * s'obtient en rendant un {@code Text} en chaine, ce qui parcourt l'arbre
     * du texte et alloue. Or ce nom ne change que si l'effet ou son niveau
     * change -- c'est-a-dire presque jamais, alors que le temps restant, lui,
     * change une fois par seconde. On garde donc les deux separement, avec ce
     * dont chacun decoule.
     */
    private static final class Entry {
        String name = "";
        String time = "";

        Object effect;
        int amplifier = Integer.MIN_VALUE;
        int seconds = Integer.MIN_VALUE;
        boolean withDuration;
    }

    private final List<Entry> pool = new ArrayList<>();
    private int count;

    @Override
    public boolean visibleInGame() {
        return count > 0;
    }

    @Override
    protected void refresh() {
        count = 0;

        ClientPlayerEntity player = client() == null ? null : client().player;
        if (player == null) {
            return;
        }

        boolean durationNow = showDuration.get();

        for (StatusEffectInstance instance : player.getStatusEffects()) {
            if (hideAmbient.get() && instance.isAmbient()) {
                continue;
            }

            Entry entry = entryAt(count++);
            // `var`: le type de l'effet ne se nomme pas de la meme facon d'une
            // version a l'autre, et on n'a besoin que de son identite et de son
            // nom -- deux choses que toutes les versions offrent pareil.
            var effect = instance.getEffectType().value();
            int amplifier = instance.getAmplifier();

            if (effect != entry.effect || amplifier != entry.amplifier) {
                entry.effect = effect;
                entry.amplifier = amplifier;

                String name = effect.getName().getString();
                entry.name = amplifier > 0 && amplifier < LEVELS.length
                    ? name + " " + LEVELS[amplifier]
                    : name;
            }

            // Une duree negative signale un effet sans fin (balise de conduit,
            // mode creatif): afficher un compte a rebours y serait faux.
            int ticks = instance.getDuration();
            int seconds = ticks < 0 ? -1 : ticks / 20;

            if (seconds != entry.seconds || durationNow != entry.withDuration) {
                entry.seconds = seconds;
                entry.withDuration = durationNow;
                entry.time = durationNow ? formatDuration(seconds) : "";
            }
        }
    }

    private Entry entryAt(int index) {
        while (pool.size() <= index) {
            pool.add(new Entry());
        }
        return pool.get(index);
    }

    /** Temps restant en m:ss, sans passer par {@code String.format}. */
    private static String formatDuration(int seconds) {
        if (seconds < 0) {
            return "--";
        }

        int rest = seconds % 60;
        return (seconds / 60) + (rest < 10 ? ":0" : ":") + rest;
    }

    /**
     * Largeur de la colonne des noms.
     *
     * <p>Recalculee a chaque appel, mais sans rien construire: le parcours porte
     * sur des chaines deja pretes. C'est la reconstruction de la liste, pas la
     * mesure, qui coutait.
     */
    private int nameWidth(TextRenderer textRenderer) {
        int widest = 0;
        for (int index = 0; index < count; index++) {
            widest = Math.max(widest, textRenderer.getWidth(pool.get(index).name));
        }
        return widest;
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int widest = 0;
        int names = nameWidth(textRenderer);
        for (int index = 0; index < count; index++) {
            String time = pool.get(index).time;
            widest = Math.max(widest, names + (time.isEmpty() ? 0 : textRenderer.getWidth(time) + 6));
        }
        return widest + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return Math.max(1, count) * textRenderer.fontHeight + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        int names = nameWidth(textRenderer);

        for (int index = 0; index < count; index++) {
            Entry entry = pool.get(index);
            int lineY = y + index * textRenderer.fontHeight;
            drawLine(context, textRenderer, entry.name, x, lineY, nameColor.argb());

            if (!entry.time.isEmpty()) {
                drawLine(context, textRenderer, entry.time, x + names + 6, lineY, timeColor.argb());
            }
        }
    }
}

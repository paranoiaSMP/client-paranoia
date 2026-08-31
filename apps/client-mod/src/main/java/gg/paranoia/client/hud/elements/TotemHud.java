package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import gg.paranoia.client.module.ModuleCategory;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;

/**
 * Ce que la seconde main tient vraiment.
 *
 * <p>Le totem se joue en seconde main et ne se voit qu'a la peripherie de
 * l'ecran, la ou l'on ne regarde pas pendant un combat. Beaucoup de morts
 * viennent simplement de ne pas avoir remarque qu'il n'y en avait plus.
 *
 * <p><strong>Ce module ne corrige pas le totem fantome, et il ne pretend pas le
 * faire.</strong> Un totem fantome est une desynchronisation: le client affiche
 * ce qu'il a predit apres un clic d'inventaire, le serveur detient la verite, et
 * quand les deux divergent on meurt avec un totem que le serveur n'a jamais eu.
 * Aucun mod client ne peut supprimer cela, puisque la verite est de l'autre cote
 * du reseau.
 *
 * <p>Ce qu'il apporte est plus modeste et reel: l'etat que le client connait,
 * affiche assez grand pour etre vu sans quitter l'adversaire des yeux. La suite
 * -- distinguer ce que le serveur a confirme de ce que le client a seulement
 * predit -- demande des signatures que la sonde n'a pas encore rendues.
 */
public final class TotemHud extends HudElement {
    private final BooleanSetting warnWhenEmpty = add(new BooleanSetting(
        "warn", "Alerter quand la main est vide", true));

    private final BooleanSetting showCount = add(new BooleanSetting(
        "count", "Afficher le nombre", true));

    private final ColorSetting held = add(new ColorSetting(
        "held", "Couleur avec totem", 0xFF57D98A));

    private final ColorSetting empty = add(new ColorSetting(
        "empty", "Couleur sans totem", 0xFFE5564B));

    public TotemHud() {
        super("totem", "Totem en main", ModuleCategory.COMBAT, false);
        placeAt(0.5, 0.68);
    }

    private String text = "Aucun totem";
    private boolean hasTotem;
    private int lastCount = Integer.MIN_VALUE;

    @Override
    protected void refresh() {
        MinecraftClient client = client();
        ClientPlayerEntity player = client == null ? null : client.player;

        if (player == null) {
            hasTotem = false;
            lastCount = 0;
            text = "Aucun totem";
            return;
        }

        ItemStack offHand = player.getOffHandStack();
        int count = offHand.isOf(Items.TOTEM_OF_UNDYING) ? offHand.getCount() : 0;

        hasTotem = count > 0;

        if (count == lastCount) {
            return;
        }
        lastCount = count;

        if (count == 0) {
            text = "Aucun totem";
        } else if (showCount.get()) {
            text = "Totem x" + count;
        } else {
            text = "Totem";
        }
    }

    /**
     * Sans totem, on n'affiche que si le joueur a demande l'alerte.
     *
     * <p>Un module de combat qui reste a l'ecran hors combat finit par etre
     * ignore, et c'est precisement au moment ou il compte qu'on ne le verrait
     * plus.
     */
    @Override
    public boolean visibleInGame() {
        return hasTotem || warnWhenEmpty.get();
    }

    @Override
    public int width(TextRenderer textRenderer) {
        // Mesure sur le libelle le plus large possible plutot que sur le texte
        // courant: sinon la boite change de taille en passant de « Totem x1 » a
        // « Aucun totem », et l'element saute a l'ecran au pire moment.
        int widest = Math.max(
            textRenderer.getWidth("Aucun totem"),
            textRenderer.getWidth("Totem x64"));
        return widest + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return textRenderer.fontHeight + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        drawLine(context, textRenderer, text, x, y, hasTotem ? held.argb() : empty.argb());
    }
}

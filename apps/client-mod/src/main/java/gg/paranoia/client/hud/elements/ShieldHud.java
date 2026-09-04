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
 * Combien de temps le bouclier reste hors service.
 *
 * <p>Un coup de hache desactive le bouclier pendant cinq secondes. C'est
 * l'ouverture que cherche l'adversaire, et c'est aussi le moment ou l'on
 * continue de cliquer droit dans le vide en croyant se proteger. Le jeu le
 * signale par une petite animation sur l'icone de l'objet, en bas de l'ecran,
 * qu'on ne regarde pas quand quelqu'un est en train de nous frapper.
 *
 * <p>Le module affiche le meme etat, en grand et au centre. Comme les autres
 * modules de combat, il ne fait que <strong>montrer ce que le client sait
 * deja</strong>: il ne leve pas le bouclier, ne raccourcit pas le delai, et ne
 * parle pas au serveur.
 *
 * <p>Le bouclier est cherche dans les deux mains. La seconde main d'abord,
 * parce que c'est la qu'il se porte presque toujours -- l'autre main tenant
 * l'arme.
 */
public final class ShieldHud extends HudElement {
    /** Duree du blocage inflige par une hache, en secondes. Sert d'echelle. */
    private static final float AXE_DISABLE_SECONDS = 5f;

    private final BooleanSetting hideWhenReady = add(new BooleanSetting(
        "hideWhenReady", "Masquer quand le bouclier est pret", true));

    private final BooleanSetting showSeconds = add(new BooleanSetting(
        "seconds", "Afficher les secondes restantes", true));

    private final ColorSetting disabled = add(new ColorSetting(
        "disabled", "Couleur hors service", 0xFFE5564B));

    private final ColorSetting available = add(new ColorSetting(
        "available", "Couleur quand pret", 0xFF57D98A));

    private final ColorSetting track = add(new ColorSetting(
        "track", "Couleur du fond de jauge", 0x60000000));

    private static final int BAR_WIDTH = 60;
    private static final int BAR_HEIGHT = 4;
    private static final int GAP = 4;

    public ShieldHud() {
        super("shield", "Etat du bouclier", ModuleCategory.COMBAT, false);
        placeAt(0.5, 0.72);
    }

    /** Part de blocage restante, 1 au moment du coup et 0 quand c'est fini. */
    private float remaining;
    private boolean carrying;

    private String text = "";
    private int lastTenths = Integer.MIN_VALUE;

    @Override
    protected void refresh() {
        MinecraftClient client = client();
        ClientPlayerEntity player = client == null ? null : client.player;

        if (player == null) {
            carrying = false;
            remaining = 0f;
            return;
        }

        ItemStack shield = shieldOf(player);
        carrying = !shield.isEmpty();

        if (!carrying) {
            remaining = 0f;
            return;
        }

        // getCooldownProgress rend 1 au moment ou le blocage commence et 0 quand
        // il est termine: c'est donc directement la part restante.
        remaining = player.getItemCooldownManager().getCooldownProgress(shield, 0f);
        remaining = Math.max(0f, Math.min(1f, remaining));

        // Au dixieme: la seconde entiere est trop grossiere pour un delai de
        // cinq secondes, et le centieme changerait a chaque image.
        int tenths = Math.round(remaining * AXE_DISABLE_SECONDS * 10f);
        if (tenths != lastTenths) {
            lastTenths = tenths;
            text = tenths == 0 ? "Pret" : String.format("%.1fs", tenths / 10f);
        }
    }

    /**
     * Le bouclier porte, seconde main d'abord.
     *
     * <p>Une pile vide veut dire qu'il n'y en a pas: le module s'efface alors
     * plutot que d'afficher l'etat d'un objet que le joueur ne tient pas.
     */
    private static ItemStack shieldOf(ClientPlayerEntity player) {
        ItemStack offHand = player.getOffHandStack();
        if (offHand.isOf(Items.SHIELD)) {
            return offHand;
        }

        ItemStack mainHand = player.getMainHandStack();
        return mainHand.isOf(Items.SHIELD) ? mainHand : ItemStack.EMPTY;
    }

    @Override
    public boolean visibleInGame() {
        if (!carrying) {
            return false;
        }
        return remaining > 0f || !hideWhenReady.get();
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int content = BAR_WIDTH;
        if (showSeconds.get()) {
            // Mesure sur le libelle le plus large que le module puisse produire,
            // jamais sur le texte courant: sinon la boite retrecirait pendant le
            // decompte et la jauge glisserait sous les yeux du joueur.
            content += GAP + Math.max(
                textRenderer.getWidth("5.0s"),
                textRenderer.getWidth("Pret"));
        }
        return content + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return textRenderer.fontHeight + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        boolean blocked = remaining > 0f;
        int color = blocked ? disabled.argb() : available.argb();

        int barY = y + (textRenderer.fontHeight - BAR_HEIGHT) / 2;
        context.fill(x, barY, x + BAR_WIDTH, barY + BAR_HEIGHT, track.argb());

        // La jauge se vide en avancant vers la droite: elle montre ce qu'il
        // reste a attendre, pas ce qui s'est ecoule.
        int filled = Math.round(BAR_WIDTH * remaining);
        if (filled > 0) {
            context.fill(x, barY, x + filled, barY + BAR_HEIGHT, color);
        }

        if (showSeconds.get()) {
            drawLine(context, textRenderer, text, x + BAR_WIDTH + GAP, y, color);
        }
    }
}

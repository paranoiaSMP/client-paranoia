package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import gg.paranoia.client.module.ModuleCategory;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;

/**
 * Ou en est la charge de l'attaque.
 *
 * <p>Depuis la 1.9, frapper avant que l'arme soit rechargee ne retire qu'une
 * fraction des degats. C'est la mecanique qui decide de la plupart des duels, et
 * le jeu ne la montre que par une petite jauge sous le reticule, seulement si on
 * a active l'option, et seulement quand on vise quelque chose. Autrement dit:
 * pas au moment ou l'on en a besoin.
 *
 * <p>Ce module lit exactement la meme valeur que le jeu et l'affiche en grand,
 * la ou le joueur regarde. <strong>Il n'ajoute aucune information que le client
 * ne possede pas deja</strong> et ne touche a rien: c'est un afficheur, pas un
 * automatisme. Rien ici ne frappe a la place du joueur.
 *
 * <p>Masque a pleine charge par defaut. Une jauge pleine en permanence devient
 * un meuble qu'on ne regarde plus; celle qui n'apparait que pendant la recharge
 * dit quelque chose a chaque fois qu'elle est la.
 */
public final class AttackChargeHud extends HudElement {
    /**
     * En dessous de ce seuil, un coup ne vaut pas la peine d'etre porte.
     *
     * <p>La courbe des degats est telle qu'a mi-charge on retire a peine plus du
     * tiers d'un coup complet. Le seuil sert a colorer, pas a empecher.
     */
    private static final float WEAK = 0.9f;

    private final BooleanSetting hideWhenReady = add(new BooleanSetting(
        "hideWhenReady", "Masquer a pleine charge", true));

    private final BooleanSetting showPercent = add(new BooleanSetting(
        "percent", "Afficher le pourcentage", true));

    private final ColorSetting charging = add(new ColorSetting(
        "charging", "Couleur en recharge", 0xFFE0A23A));

    private final ColorSetting ready = add(new ColorSetting(
        "ready", "Couleur a pleine charge", 0xFF57D98A));

    private final ColorSetting track = add(new ColorSetting(
        "track", "Couleur du fond de jauge", 0x60000000));

    /** Largeur de la jauge, en pixels d'interface. */
    private static final int BAR_WIDTH = 60;
    private static final int BAR_HEIGHT = 4;
    private static final int GAP = 4;

    public AttackChargeHud() {
        super("attackCharge", "Charge d'attaque", ModuleCategory.COMBAT, false);
        placeAt(0.5, 0.62);
    }

    /** Charge de l'image en cours, 0 a 1. */
    private float progress = 1f;
    private boolean visible;

    private String text = "100%";
    private int lastPercent = Integer.MIN_VALUE;

    @Override
    protected void refresh() {
        MinecraftClient client = client();
        ClientPlayerEntity player = client == null ? null : client.player;

        if (player == null) {
            visible = false;
            return;
        }

        // Zero en argument, et non le temps partiel de l'image: on veut la
        // charge a cet instant precis, pas celle interpolee vers le tick
        // suivant. Un joueur qui frappe se fie a ce qu'il voit maintenant.
        progress = player.getAttackCooldownProgress(0f);

        // Le jeu peut rendre une valeur legerement au-dela des bornes selon le
        // moment ou l'on interroge; on la ramene avant de s'en servir pour un
        // pourcentage ou une largeur.
        progress = Math.max(0f, Math.min(1f, progress));

        visible = !hideWhenReady.get() || progress < 1f;

        int percent = Math.round(progress * 100f);
        if (percent != lastPercent) {
            lastPercent = percent;
            text = percent + "%";
        }
    }

    @Override
    public boolean visibleInGame() {
        return visible;
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int content = BAR_WIDTH;
        if (showPercent.get()) {
            // Mesure sur « 100% » et non sur la valeur courante: sinon la boite
            // se retrecit en passant de 100 a 99, et la jauge se deplacerait
            // sous les yeux du joueur pendant la recharge.
            content += GAP + textRenderer.getWidth("100%");
        }
        return content + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return textRenderer.fontHeight + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        boolean full = progress >= 1f;
        int fill = full ? ready.argb() : charging.argb();

        // La jauge est centree sur la hauteur du texte pour que les deux
        // paraissent sur la meme ligne.
        int barY = y + (textRenderer.fontHeight - BAR_HEIGHT) / 2;

        context.fill(x, barY, x + BAR_WIDTH, barY + BAR_HEIGHT, track.argb());

        int filled = Math.round(BAR_WIDTH * progress);
        if (filled > 0) {
            context.fill(x, barY, x + filled, barY + BAR_HEIGHT, fill);
        }

        if (showPercent.get()) {
            // En dessous du seuil, le chiffre prend la couleur de recharge meme
            // si la jauge parait presque pleine: c'est la ou l'ecart entre « on
            // dirait que c'est bon » et « le coup ne vaut rien » se joue.
            int color = progress >= WEAK ? fill : charging.argb();
            drawLine(context, textRenderer, text, x + BAR_WIDTH + GAP, y, color);
        }
    }
}

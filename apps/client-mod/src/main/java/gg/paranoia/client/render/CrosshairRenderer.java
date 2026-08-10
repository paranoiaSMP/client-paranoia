package gg.paranoia.client.render;

import gg.paranoia.client.modules.CrosshairModule;
import gg.paranoia.client.modules.HitIndicatorModule;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;

/**
 * Dessin du crosshair personnalise.
 *
 * <p>Uniquement des appels a {@code fill}: c'est la seule primitive de dessin
 * dont la signature n'a pas bouge entre les versions ciblees, ce qui permet de
 * garder ce code partage plutot que duplique par version.
 */
public final class CrosshairRenderer {
    private CrosshairRenderer() {
    }

    /** @return true si le crosshair du jeu doit etre remplace par le notre. */
    public static boolean render(DrawContext context) {
        CrosshairModule module = CrosshairModule.instance();
        if (module == null || !module.enabled()) {
            return false;
        }

        MinecraftClient client = MinecraftClient.getInstance();
        if (client == null || client.player == null) {
            return false;
        }

        float cooldown = client.player.getAttackCooldownProgress(0f);

        int color = module.color();
        HitIndicatorModule indicator = HitIndicatorModule.instance();
        if (indicator != null) {
            int highlight = indicator.colorFor(cooldown);
            if (highlight != 0) {
                color = highlight;
            }
        }

        int centerX = context.getScaledWindowWidth() / 2;
        int centerY = context.getScaledWindowHeight() / 2;

        int gap = module.gap(cooldown);
        int length = module.length();
        int thickness = module.thickness();

        if (module.outline()) {
            // Contour dessine d'abord, un pixel plus large de chaque cote:
            // sans lui le crosshair devient illisible sur un ciel clair.
            draw(context, module, centerX, centerY, gap, length, thickness + 2, 0xC0000000, true);
        }
        draw(context, module, centerX, centerY, gap, length, thickness, color, false);
        return true;
    }

    private static void draw(
        DrawContext context, CrosshairModule module,
        int centerX, int centerY, int gap, int length, int thickness, int color, boolean outline) {
        // Le contour deborde d'un pixel autour de la forme.
        int spread = outline ? 1 : 0;
        int half = thickness / 2;

        switch (module.shape()) {
            case DOT -> context.fill(
                centerX - half - spread, centerY - half - spread,
                centerX + thickness - half + spread, centerY + thickness - half + spread, color);

            case CROSS -> {
                horizontal(context, centerX, centerY, gap, length, thickness, half, spread, color);
                vertical(context, centerX, centerY, gap, length, thickness, half, spread, color, true);
            }

            case TEE -> {
                horizontal(context, centerX, centerY, gap, length, thickness, half, spread, color);
                // Branche du bas seulement: laisse la vue degagee vers le haut.
                context.fill(
                    centerX - half - spread, centerY + gap - spread,
                    centerX + thickness - half + spread, centerY + gap + length + spread, color);
            }

            case CIRCLE -> {
                int radius = Math.max(1, gap + length / 2);
                // Cercle approche par quatre segments: la primitive fill ne sait
                // dessiner que des rectangles.
                context.fill(centerX - radius, centerY - 1, centerX - radius + thickness, centerY + 1, color);
                context.fill(centerX + radius - thickness, centerY - 1, centerX + radius, centerY + 1, color);
                context.fill(centerX - 1, centerY - radius, centerX + 1, centerY - radius + thickness, color);
                context.fill(centerX - 1, centerY + radius - thickness, centerX + 1, centerY + radius, color);
            }

            default -> {
            }
        }
    }

    private static void horizontal(
        DrawContext context, int centerX, int centerY,
        int gap, int length, int thickness, int half, int spread, int color) {
        context.fill(
            centerX - gap - length - spread, centerY - half - spread,
            centerX - gap + spread, centerY + thickness - half + spread, color);
        context.fill(
            centerX + gap - spread, centerY - half - spread,
            centerX + gap + length + spread, centerY + thickness - half + spread, color);
    }

    private static void vertical(
        DrawContext context, int centerX, int centerY,
        int gap, int length, int thickness, int half, int spread, int color, boolean both) {
        context.fill(
            centerX - half - spread, centerY - gap - length - spread,
            centerX + thickness - half + spread, centerY - gap + spread, color);
        if (both) {
            context.fill(
                centerX - half - spread, centerY + gap - spread,
                centerX + thickness - half + spread, centerY + gap + length + spread, color);
        }
    }
}

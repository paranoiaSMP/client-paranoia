package gg.paranoia.client.platform;

import net.minecraft.client.gui.DrawContext;

/** Ce que la plateforme appelle a chaque image pour dessiner les HUD en jeu. */
@FunctionalInterface
public interface HudRenderer {
    void render(DrawContext context, float tickDelta);
}

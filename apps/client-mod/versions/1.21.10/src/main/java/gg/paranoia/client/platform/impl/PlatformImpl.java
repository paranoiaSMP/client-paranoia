package gg.paranoia.client.platform.impl;

import gg.paranoia.client.menu.MenuController;
import gg.paranoia.client.menu.ParanoiaMenuScreen;
import gg.paranoia.client.platform.ClientPlatform;
import gg.paranoia.client.platform.HudRenderer;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;

/** Branchements propres a Minecraft 1.21.10. */
public final class PlatformImpl implements ClientPlatform {
    @Override
    public String minecraftVersion() {
        return "1.21.10";
    }

    @Override
    public void registerHudRenderer(HudRenderer renderer) {
        // Le second parametre est le compteur d'images: inutilise, et ses
        // methodes different selon la version, donc on ne le touche pas.
        HudRenderCallback.EVENT.register((context, tickCounter) -> renderer.render(context));
    }

    @Override
    public Screen createMenuScreen(MenuController controller) {
        return new ParanoiaMenuScreen(controller);
    }

    @Override
    public void pushScale(DrawContext context, float scale, int pivotX, int pivotY) {
        // getMatrices() renvoie un Matrix3x2fStack (JOML, 2D): pushMatrix/popMatrix
        // et des translate/scale a deux composantes, pas le MatrixStack 3D d'avant.
        context.getMatrices().pushMatrix();
        context.getMatrices().translate(pivotX, pivotY);
        context.getMatrices().scale(scale, scale);
    }

    @Override
    public void popScale(DrawContext context) {
        context.getMatrices().popMatrix();
    }
}

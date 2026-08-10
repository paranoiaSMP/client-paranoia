package gg.paranoia.client.platform.impl;

import gg.paranoia.client.platform.ClientPlatform;
import gg.paranoia.client.platform.HudRenderer;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import org.lwjgl.glfw.GLFW;

/** Branchements propres a Minecraft 1.21.11. */
public final class PlatformImpl implements ClientPlatform {
    @Override
    public String minecraftVersion() {
        return "1.21.11";
    }

    @Override
    public void registerHudRenderer(HudRenderer renderer) {
        // Le second parametre est le compteur d'images: inutilise, et son nom de
        // methode differe selon la version, donc on ne le touche pas.
        HudRenderCallback.EVENT.register((context, tickCounter) -> renderer.render(context));
    }

    @Override
    public void registerMenuKey(Runnable onPressed) {
        KeyBinding key = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.paranoia.menu",
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_RIGHT_SHIFT,
            "key.categories.paranoia"));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            while (key.wasPressed()) {
                onPressed.run();
            }
        });
    }

    @Override
    public void renderMenuBackdrop(Screen screen, DrawContext context, int mouseX, int mouseY, float delta) {
        screen.renderBackground(context, mouseX, mouseY, delta);
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

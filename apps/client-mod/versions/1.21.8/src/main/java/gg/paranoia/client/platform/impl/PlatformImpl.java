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

/** Branchements propres a Minecraft 1.21.8. */
public final class PlatformImpl implements ClientPlatform {
    @Override
    public String minecraftVersion() {
        return "1.21.8";
    }

    @Override
    public void registerHudRenderer(HudRenderer renderer) {
        HudRenderCallback.EVENT.register(
            (context, tickCounter) -> renderer.render(context, tickCounter.getTickDelta(true)));
    }

    @Override
    public void registerMenuKey(Runnable onPressed) {
        KeyBinding key = KeyBindingHelper.registerKeyBinding(new KeyBinding(
            "key.paranoia.menu",
            InputUtil.Type.KEYSYM,
            GLFW.GLFW_KEY_RIGHT_SHIFT,
            "key.categories.paranoia"));

        ClientTickEvents.END_CLIENT_TICK.register(client -> {
            // wasPressed() se vide a chaque appel: une boucle evite de perdre un
            // appui survenu pendant une image longue.
            while (key.wasPressed()) {
                onPressed.run();
            }
        });
    }

    @Override
    public void renderMenuBackdrop(Screen screen, DrawContext context, int mouseX, int mouseY, float delta) {
        // renderBackground applique deja le flou d'arriere-plan configure dans
        // les options du jeu, ainsi que l'assombrissement des menus.
        screen.renderBackground(context, mouseX, mouseY, delta);
    }

    @Override
    public void pushScale(DrawContext context, float scale, int pivotX, int pivotY) {
        context.getMatrices().push();
        context.getMatrices().translate(pivotX, pivotY, 0.0f);
        context.getMatrices().scale(scale, scale, 1.0f);
    }

    @Override
    public void popScale(DrawContext context) {
        context.getMatrices().pop();
    }
}

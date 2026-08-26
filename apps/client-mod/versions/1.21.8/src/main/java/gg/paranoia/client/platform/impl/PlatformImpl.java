package gg.paranoia.client.platform.impl;

import gg.paranoia.client.menu.MenuController;
import gg.paranoia.client.menu.ParanoiaMenuScreen;
import gg.paranoia.client.platform.ClientPlatform;
import gg.paranoia.client.platform.HudRenderer;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.util.Identifier;

import java.util.UUID;

/** Branchements propres a Minecraft 1.21.8. */
public final class PlatformImpl implements ClientPlatform {
    @Override
    public String minecraftVersion() {
        return "1.21.8";
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

    @Override
    public UUID profileId(PlayerListEntry entry) {
        // GameProfile est une classe dans cette version.
        return entry.getProfile().getId();
    }

    @Override
    public Identifier registerCosmeticTexture(String path, NativeImage image) {
        Identifier id = Identifier.of("paranoia", path);
        // L'etiquette est une chaine de journalisation, evaluee paresseusement
        // par le jeu quand il decrit ses textures.
        MinecraftClient.getInstance().getTextureManager()
            .registerTexture(id, new NativeImageBackedTexture(id::toString, image));
        return id;
    }

    @Override
    public void unregisterCosmeticTexture(Identifier id) {
        MinecraftClient.getInstance().getTextureManager().destroyTexture(id);
    }
}

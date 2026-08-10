package gg.paranoia.client.mixin;

import gg.paranoia.client.render.CrosshairRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.hud.InGameHud;
import net.minecraft.client.render.RenderTickCounter;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Remplace le crosshair du jeu par celui du client quand le module est actif.
 *
 * <p>{@code renderCrosshair} est privee, mais sa signature est identique sur
 * les deux versions ciblees: ce mixin vit donc dans les sources partagees.
 */
@Mixin(InGameHud.class)
public abstract class InGameHudMixin {
    @Inject(method = "renderCrosshair", at = @At("HEAD"), cancellable = true)
    private void paranoia$replaceCrosshair(
        DrawContext context, RenderTickCounter tickCounter, CallbackInfo info) {
        // Le rendu ne s'annule que s'il a effectivement dessine quelque chose:
        // module desactive ou hors du jeu, le crosshair vanilla doit rester.
        if (CrosshairRenderer.render(context)) {
            info.cancel();
        }
    }
}

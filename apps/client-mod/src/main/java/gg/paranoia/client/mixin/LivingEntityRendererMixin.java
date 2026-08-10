package gg.paranoia.client.mixin;

import gg.paranoia.client.modules.ColorHitModule;
import net.minecraft.client.render.entity.LivingEntityRenderer;
import net.minecraft.client.render.entity.state.LivingEntityRenderState;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Couleur de la teinte appliquee a une entite touchee.
 *
 * <p>{@code getMixColor} est deja ce que le jeu consulte pour teinter en rouge
 * une entite qui encaisse un coup. On ne remplace que la couleur, quand le jeu
 * a decide qu'il fallait teinter: inutile de suivre soi-meme les degats.
 *
 * <p>La signature est identique sur les deux versions ciblees, ce mixin vit
 * donc dans les sources partagees.
 */
@Mixin(LivingEntityRenderer.class)
public abstract class LivingEntityRendererMixin {
    @Inject(method = "getMixColor", at = @At("RETURN"), cancellable = true)
    private void paranoia$recolorHit(
        LivingEntityRenderState state, CallbackInfoReturnable<Integer> info) {
        ColorHitModule module = ColorHitModule.instance();
        if (module == null || !module.enabled()) {
            return;
        }

        // Alpha nul: le jeu ne teinte pas cette entite a cet instant, il n'y a
        // donc rien a recolorer.
        int original = info.getReturnValue();
        if ((original >>> 24) == 0) {
            return;
        }

        info.setReturnValue(module.color());
    }
}

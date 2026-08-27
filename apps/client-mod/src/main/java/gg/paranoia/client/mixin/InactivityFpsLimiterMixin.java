package gg.paranoia.client.mixin;

import gg.paranoia.client.modules.FocusFpsModule;
import net.minecraft.client.option.InactivityFpsLimiter;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Ajoute la perte de focus aux raisons de ralentir.
 *
 * <p>{@code update()} est l'endroit ou le jeu arrete sa limite d'images pour
 * l'instant present, en pesant fenetre reduite, menu ouvert et duree
 * d'inactivite. S'y greffer plutot que de piloter le reglage du joueur evite
 * deux ennuis: on n'ecrit rien dans ses options -- un plantage pendant qu'il
 * est ailleurs ne lui laisserait pas un jeu bride au redemarrage -- et on
 * herite de tout ce que vanilla decide deja.
 *
 * <p>Mixin commun aux trois versions.
 */
@Mixin(InactivityFpsLimiter.class)
public abstract class InactivityFpsLimiterMixin {
    @Inject(method = "update", at = @At("RETURN"), cancellable = true)
    private void paranoia$limitWhenUnfocused(CallbackInfoReturnable<Integer> info) {
        int vanilla = info.getReturnValueI();
        int limited = FocusFpsModule.clamp(vanilla);
        if (limited != vanilla) {
            info.setReturnValue(limited);
        }
    }
}

package gg.paranoia.client.mixin;

import gg.paranoia.client.modules.BrightnessModule;
import net.minecraft.client.render.LightmapTextureManager;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Plancher de luminosite pour le module Luminosite.
 *
 * <p>On agit sur {@code getBrightness(float, int)}, qui rend la luminosite
 * associee a un niveau de lumiere, plutot que sur l'option gamma: celle-ci est
 * bornee a 1.0 par le jeu, et la contourner demanderait de reecrire la
 * validation de l'option.
 *
 * <p>La signature est identique sur les deux versions ciblees, ce mixin vit
 * donc dans les sources partagees.
 */
@Mixin(LightmapTextureManager.class)
public abstract class LightmapTextureManagerMixin {
    @Inject(method = "getBrightness(FI)F", at = @At("RETURN"), cancellable = true)
    private static void paranoia$applyBrightnessFloor(
        float dimensionBrightness, int lightLevel, CallbackInfoReturnable<Float> info) {
        BrightnessModule module = BrightnessModule.instance();
        // enabled() rend deja false quand le serveur interdit le module.
        if (module == null || !module.enabled()) {
            return;
        }

        float floor = module.floor();
        if (floor <= 0f) {
            return;
        }

        // On releve sans jamais assombrir: un joueur qui monte le curseur
        // s'attend a voir plus clair, pas a perdre les zones deja eclairees.
        float original = info.getReturnValue();
        if (floor > original) {
            info.setReturnValue(floor);
        }
    }
}

package gg.paranoia.client.mixin;

import gg.paranoia.client.modules.EntityCullingModule;
import net.minecraft.client.render.Frustum;
import net.minecraft.client.render.entity.EntityRenderer;
import net.minecraft.entity.Entity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Retire du rendu le decor lointain, avant qu'il ne coute quoi que ce soit.
 *
 * <p>{@code shouldRender} est l'endroit exact ou le jeu decide si une entite
 * merite d'etre dessinee -- c'est deja la qu'il applique son propre test de
 * champ de vision. S'y greffer signifie que l'entite ecartee ne coute ni etat
 * de rendu, ni modele, ni sommet: on ne l'accelere pas, on ne la produit pas.
 *
 * <p>On ne repond jamais {@code true}: uniquement {@code false}, et seulement
 * pour ce que {@link EntityCullingModule} autorise a ecarter. Le jeu garde donc
 * le dernier mot sur tout le reste, et ce mixin ne peut pas faire apparaitre
 * quelque chose que vanilla aurait cache.
 *
 * <p>Mixin commun aux trois versions.
 */
@Mixin(EntityRenderer.class)
public abstract class EntityRendererCullingMixin {
    @Inject(method = "shouldRender", at = @At("HEAD"), cancellable = true)
    private void paranoia$cullDistantClutter(
        Entity entity, Frustum frustum, double cameraX, double cameraY, double cameraZ,
        CallbackInfoReturnable<Boolean> info) {

        if (EntityCullingModule.shouldSkip(entity, entity.squaredDistanceTo(cameraX, cameraY, cameraZ))) {
            info.setReturnValue(false);
        }
    }
}

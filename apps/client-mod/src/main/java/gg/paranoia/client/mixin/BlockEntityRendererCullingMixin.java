package gg.paranoia.client.mixin;

import gg.paranoia.client.modules.BlockEntityCullingModule;
import net.minecraft.block.entity.BlockEntity;
import net.minecraft.client.render.block.entity.BlockEntityRenderer;
import net.minecraft.util.math.Vec3d;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Abaisse la portee des blocs animes, la ou le jeu decide de les dessiner.
 *
 * <p>{@code isInRenderDistance} est le pendant exact de {@code shouldRender}
 * pour les blocs animes: s'y greffer signifie que le coffre ecarte ne coute ni
 * etat de rendu, ni modele, ni sommet.
 *
 * <p>On ne repond jamais {@code true}: uniquement {@code false}, et seulement
 * pour ce que {@link BlockEntityCullingModule} autorise. Le jeu garde le dernier
 * mot sur tout le reste.
 *
 * <h2>Pourquoi {@code require = 0} ici, et nulle part ailleurs</h2>
 *
 * <p>Tout le reste du mod injecte avec {@code defaultRequire: 1}, et c'est
 * volontaire: une cible disparue doit se voir bruyamment au demarrage plutot que
 * de produire un mod a moitie fonctionnel. Cette injection deroge a la regle,
 * pour une raison precise.
 *
 * <p>C'est la premiere du depot a viser la methode par defaut d'une
 * <em>interface</em> et non le corps d'une classe. Si mixin refusait cette
 * construction, la regle habituelle empecherait le jeu de demarrer -- chez tous
 * les joueurs, y compris ceux qui n'ont jamais active le module, puisqu'un mixin
 * s'applique independamment des reglages. Faire dependre le demarrage du jeu
 * d'un confort de framerate serait un mauvais echange.
 *
 * <p>Le pire cas devient donc: la fonction ne fait rien. Et pour que ce silence
 * ne passe pas inapercu, le module compte ce qu'il ecarte et le panneau de
 * diagnostic l'affiche -- un compteur qui reste a zero alors que le module est
 * actif est la preuve que l'injection n'a pas pris.
 *
 * <p>Mixin commun aux trois versions.
 */
@Mixin(BlockEntityRenderer.class)
public interface BlockEntityRendererCullingMixin {
    @Inject(method = "isInRenderDistance", at = @At("HEAD"), cancellable = true, require = 0)
    private void paranoia$cullDistantBlockEntities(
        BlockEntity blockEntity, Vec3d cameraPos, CallbackInfoReturnable<Boolean> info) {

        // Type brut volontaire: l'interface porte deux parametres de type sur
        // les versions recentes et le nombre a deja bouge par le passe. Le type
        // brut traverse ces changements sans que le mixin ait a les suivre, et
        // getRenderDistance ne depend d'aucun des deux.
        @SuppressWarnings("rawtypes")
        BlockEntityRenderer self = (BlockEntityRenderer) this;

        if (BlockEntityCullingModule.shouldSkip(blockEntity, cameraPos, self.getRenderDistance())) {
            info.setReturnValue(false);
        }
    }
}

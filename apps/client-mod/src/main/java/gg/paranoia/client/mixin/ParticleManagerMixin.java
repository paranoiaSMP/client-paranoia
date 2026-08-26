package gg.paranoia.client.mixin;

import gg.paranoia.client.modules.ParticleBudgetModule;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleManager;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Ecrete les rafales de particules a leur naissance.
 *
 * <p>{@code addParticle(Particle)} est l'entonnoir: toutes les particules du
 * jeu y passent, y compris celles que produit la variante a coordonnees. Un
 * seul point d'accroche suffit donc a tout couvrir.
 *
 * <p>La variante a coordonnees rend une {@code Particle} et n'est
 * volontairement pas touchee: l'annuler obligerait a rendre {@code null} a des
 * appelants dont rien ne garantit qu'ils s'y attendent. Celle-ci ne rend rien,
 * l'annuler n'a donc aucun effet de bord.
 *
 * <p>Mixin commun aux trois versions: la sonde confirme la meme signature
 * partout.
 */
@Mixin(ParticleManager.class)
public abstract class ParticleManagerMixin {
    @Inject(method = "addParticle(Lnet/minecraft/client/particle/Particle;)V",
        at = @At("HEAD"), cancellable = true)
    private void paranoia$budget(Particle particle, CallbackInfo info) {
        if (ParticleBudgetModule.shouldDrop()) {
            info.cancel();
        }
    }
}

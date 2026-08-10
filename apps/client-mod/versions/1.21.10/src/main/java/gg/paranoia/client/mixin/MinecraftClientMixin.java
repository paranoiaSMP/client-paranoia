package gg.paranoia.client.mixin;

import net.minecraft.client.MinecraftClient;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;

/**
 * Mixin de reference: il ne modifie aucun comportement, il sert a prouver que la
 * chaine mixin est bien branchee (config chargee, refmap generee par loom,
 * classe appliquee au demarrage) avant que les modules qui en dependent
 * vraiment -- fullbright, crosshair personnalise, color hit -- soient ecrits.
 *
 * <p>Volontairement sans {@code @Inject}: cibler une methode demanderait un nom
 * mappe qui differe d'une version a l'autre, ce qui est precisement ce qu'on
 * veut valider en CI plutot que supposer.
 */
@Mixin(MinecraftClient.class)
public abstract class MinecraftClientMixin {
    @Unique
    private static final String PARANOIA_MIXIN_MARKER = "paranoia-client";
}

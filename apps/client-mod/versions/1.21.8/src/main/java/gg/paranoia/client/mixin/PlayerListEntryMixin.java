package gg.paranoia.client.mixin;

import com.mojang.authlib.GameProfile;
import gg.paranoia.client.cosmetics.CosmeticCapes;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.util.SkinTextures;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Cape Paranoia, substituee dans les donnees de peau du joueur.
 *
 * <p>C'est le seul endroit ou le jeu decide de la cape d'un joueur, quel que
 * soit ce qui la dessine ensuite: le rendu en jeu, l'apercu du menu, la liste
 * des joueurs. En remplacant ici, on herite de toute la physique de cape de
 * Minecraft au lieu d'avoir a la reecrire.
 *
 * <p>Propre a 1.21.8: {@code SkinTextures} vit dans {@code client.util} et
 * porte la cape sous forme d'identifiant. Les versions suivantes l'ont deplace
 * dans {@code entity.player} et remplace ce champ par un objet d'asset.
 */
@Mixin(PlayerListEntry.class)
public abstract class PlayerListEntryMixin {
    @org.spongepowered.asm.mixin.Shadow
    public abstract GameProfile getProfile();

    @Inject(method = "getSkinTextures", at = @At("RETURN"), cancellable = true)
    private void paranoia$wearCape(CallbackInfoReturnable<SkinTextures> info) {
        GameProfile profile = getProfile();
        if (profile == null) {
            return;
        }

        SkinTextures vanilla = info.getReturnValue();
        SkinTextures worn = CosmeticCapes.patched(
            profile.getId(),
            vanilla,
            // L'enregistrement porte six composants dans cette version: on ne
            // touche qu'a la cape et on recopie le reste tel quel.
            (textures, cape) -> new SkinTextures(
                textures.texture(),
                textures.textureUrl(),
                cape,
                textures.elytraTexture(),
                textures.model(),
                textures.secure()));

        if (worn != vanilla) {
            info.setReturnValue(worn);
        }
    }
}

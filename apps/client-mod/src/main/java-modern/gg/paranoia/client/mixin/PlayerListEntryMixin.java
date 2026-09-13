package gg.paranoia.client.mixin;

import com.mojang.authlib.GameProfile;
import gg.paranoia.client.cosmetics.CosmeticCapes;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.entity.player.SkinTextures;
import net.minecraft.util.AssetInfo;
import net.minecraft.util.Identifier;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
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
 * <p>Propre aux versions recentes: {@code SkinTextures} a quitte
 * {@code client.util} pour {@code entity.player}, et sa cape n'est plus un
 * identifiant mais un {@code AssetInfo.TextureAsset} -- une interface a deux
 * methodes, d'ou le petit enregistrement ci-dessous.
 */
@Mixin(PlayerListEntry.class)
public abstract class PlayerListEntryMixin {
    @Shadow
    public abstract GameProfile getProfile();

    /**
     * Notre texture, presentee comme un asset du jeu.
     *
     * <p>Les deux methodes rendent le meme identifiant, et c'est correct: nos
     * textures sont enregistrees aupres du gestionnaire sous cet identifiant
     * exact, il n'y a donc pas de chemin de fichier distinct a exposer.
     */
    private record ParanoiaCapeAsset(Identifier id) implements AssetInfo.TextureAsset {
        @Override
        public Identifier texturePath() {
            return id;
        }
    }

    @Inject(method = "getSkinTextures", at = @At("RETURN"), cancellable = true)
    private void paranoia$wearCape(CallbackInfoReturnable<SkinTextures> info) {
        GameProfile profile = getProfile();
        if (profile == null) {
            return;
        }

        SkinTextures vanilla = info.getReturnValue();
        SkinTextures worn = CosmeticCapes.patched(
            // GameProfile est un record dans cette version.
            profile.id(),
            vanilla,
            (textures, cape) -> new SkinTextures(
                textures.body(),
                new ParanoiaCapeAsset(cape),
                textures.elytra(),
                textures.model(),
                textures.secure()));

        if (worn != vanilla) {
            info.setReturnValue(worn);
        }
    }
}

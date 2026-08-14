package gg.paranoia.client.mixin;

import gg.paranoia.client.modules.BadgeModule;
import gg.paranoia.client.platform.Platforms;
import net.minecraft.client.gui.hud.PlayerListHud;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

/**
 * Badge Paranoia dans la liste des joueurs (touche Tab).
 *
 * <p>On passe par le nom rendu plutot que par le dessin: {@code getPlayerName}
 * est le seul endroit ou le jeu decide de ce qui s'affiche pour un joueur, quel
 * que soit son classement, son equipe ou son prefixe. Dessiner par-dessus
 * demanderait de recalculer une position que le jeu change d'une version a
 * l'autre.
 */
@Mixin(PlayerListHud.class)
public abstract class PlayerListHudMixin {
    @Inject(method = "getPlayerName", at = @At("RETURN"), cancellable = true)
    private void paranoia$addBadge(PlayerListEntry entry, CallbackInfoReturnable<Text> info) {
        if (entry == null || entry.getProfile() == null) {
            return;
        }

        // L'identifiant passe par la plateforme: GameProfile est une classe en
        // 1.21.8 et un record ensuite, getId() d'un cote, id() de l'autre.
        Text decorated =
            BadgeModule.decorate(info.getReturnValue(), Platforms.get().profileId(entry), true);
        if (decorated != info.getReturnValue()) {
            info.setReturnValue(decorated);
        }
    }
}

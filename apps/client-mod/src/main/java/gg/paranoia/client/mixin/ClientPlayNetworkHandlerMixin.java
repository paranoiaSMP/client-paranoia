package gg.paranoia.client.mixin;

import gg.paranoia.client.net.ServerTpsTracker;
import net.minecraft.client.network.ClientPlayNetworkHandler;
import net.minecraft.network.packet.s2c.play.WorldTimeUpdateS2CPacket;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Alimente l'estimation du TPS a partir des annonces d'heure du monde.
 *
 * <p>La signature est identique sur les deux versions ciblees, ce mixin vit
 * donc dans les sources partagees.
 *
 * <p>La remise a zero entre deux serveurs ne se fait pas ici: {@code
 * onDisconnected} est heritee de {@code ClientCommonNetworkHandler} et n'existe
 * pas sur cette classe, une injection dessus fait planter le jeu au demarrage.
 * Elle passe par {@code ClientPlayConnectionEvents.DISCONNECT}, qui couvre
 * exactement le meme moment sans mixin.
 */
@Mixin(ClientPlayNetworkHandler.class)
public abstract class ClientPlayNetworkHandlerMixin {
    @Inject(method = "onWorldTimeUpdate", at = @At("TAIL"))
    private void paranoia$trackServerTps(WorldTimeUpdateS2CPacket packet, CallbackInfo info) {
        ServerTpsTracker.onWorldTime(packet.time());
    }
}

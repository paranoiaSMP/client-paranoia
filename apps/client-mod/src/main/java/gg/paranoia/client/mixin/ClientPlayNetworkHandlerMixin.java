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
 */
@Mixin(ClientPlayNetworkHandler.class)
public abstract class ClientPlayNetworkHandlerMixin {
    @Inject(method = "onWorldTimeUpdate", at = @At("TAIL"))
    private void paranoia$trackServerTps(WorldTimeUpdateS2CPacket packet, CallbackInfo info) {
        ServerTpsTracker.onWorldTime(packet.time());
    }

    @Inject(method = "onDisconnected", at = @At("HEAD"))
    private void paranoia$resetServerTps(CallbackInfo info) {
        // Sans ca, le TPS du serveur precedent resterait affiche sur le suivant.
        ServerTpsTracker.reset();
    }
}

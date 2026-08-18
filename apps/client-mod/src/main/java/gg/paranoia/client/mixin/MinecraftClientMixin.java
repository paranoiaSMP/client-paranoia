package gg.paranoia.client.mixin;

import net.minecraft.client.MinecraftClient;
import net.minecraft.SharedConstants;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(MinecraftClient.class)
public abstract class MinecraftClientMixin {
    @Inject(method = "getWindowTitle", at = @At("RETURN"), cancellable = true)
    private void paranoia$overrideWindowTitle(CallbackInfoReturnable<String> cir) {
        cir.setReturnValue("Paranoia Client (" + SharedConstants.getGameVersion().getName() + ")");
    }
}

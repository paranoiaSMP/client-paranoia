package gg.paranoia.client.mixin;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import gg.paranoia.client.ParanoiaClient;
import gg.paranoia.client.modules.MenuAccueilModule;
import gg.paranoia.client.platform.Platforms;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(MinecraftClient.class)
public abstract class MinecraftClientMixin {
    @Inject(method = "getWindowTitle", at = @At("RETURN"), cancellable = true)
    private void paranoia$overrideWindowTitle(CallbackInfoReturnable<String> cir) {
        cir.setReturnValue("Paranoia Client (" + Platforms.get().minecraftVersion() + ")");
    }

    /**
     * Remplace l'ecran-titre du jeu par celui de Paranoia.
     *
     * <p>{@code @ModifyVariable} sur l'argument, et non un {@code @Inject}
     * suivi d'un second {@code setScreen}: rappeler la methode depuis
     * l'interieur d'elle-meme ouvrirait une recursion qu'il faudrait ensuite
     * garder avec un drapeau. Ici l'argument est change avant que le corps
     * s'execute, et le jeu ne voit jamais qu'un seul appel.
     *
     * <p>Trois conditions avant de substituer. Le module doit exister -- le
     * jeu pose son premier ecran-titre tres tot, possiblement avant que les
     * modules soient enregistres -- il doit etre actif, et l'ecran doit etre
     * l'ecran-titre d'origine. La derniere garde contre le cas ou notre propre
     * ecran repasserait par ici.
     */
    @ModifyVariable(method = "setScreen", at = @At("HEAD"), argsOnly = true)
    private Screen paranoia$remplaceEcranTitre(Screen screen) {
        if (!(screen instanceof TitleScreen)) {
            return screen;
        }

        MenuAccueilModule reglages = MenuAccueilModule.instance();
        if (reglages == null || !reglages.enabled() || !Platforms.installed()) {
            return screen;
        }

        return Platforms.get().createTitleScreen(ParanoiaClient.titleController());
    }
}

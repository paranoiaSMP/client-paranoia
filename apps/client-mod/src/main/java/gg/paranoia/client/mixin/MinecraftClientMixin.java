package gg.paranoia.client.mixin;

import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.TitleScreen;
import gg.paranoia.client.ParanoiaClient;
import gg.paranoia.client.modules.MenuAccueilModule;
import gg.paranoia.client.platform.Platforms;
import org.slf4j.LoggerFactory;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Unique;
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
     *
     * <p>{@code require = 0}, contre la regle du fichier de mixins, et c'est
     * la seule exception du mod. Avec le reglage par defaut, une injection qui
     * ne s'applique pas est fatale au demarrage -- ce qui est exactement ce
     * qu'on veut pour un mixin dont depend le jeu. Celui-ci ne change qu'un
     * ecran: empecher de jouer parce qu'un fond d'ecran n'a pas pu se poser
     * serait hors de proportion. S'il ne s'applique pas, l'ecran-titre
     * d'origine reste, et le journal ne dit rien -- c'est precisement ce que
     * la ligne ci-dessous permet de distinguer.
     *
     * <p>Et c'est la seule chose que la CI ne peut pas verifier. Elle compile
     * le mod et verifie que {@code setScreen} existe bien sur
     * {@code MinecraftClient} -- {@code check-mixin-targets.mjs} le fait pour
     * chaque version -- mais elle ne lance pas Minecraft. L'application reelle
     * du mixin se constate au premier demarrage, et cette ligne est la pour
     * qu'elle se constate en une seconde.
     */
    @ModifyVariable(method = "setScreen", at = @At("HEAD"), argsOnly = true, require = 0)
    private Screen paranoia$remplaceEcranTitre(Screen screen) {
        if (!(screen instanceof TitleScreen)) {
            return screen;
        }

        MenuAccueilModule reglages = MenuAccueilModule.instance();
        if (reglages == null || !reglages.enabled() || !Platforms.installed()) {
            paranoia$annonce("ecran-titre d'origine garde"
                + (reglages == null ? " (modules pas encore charges)"
                    : !reglages.enabled() ? " (module desactive)"
                    : " (plateforme pas encore installee)"));
            return screen;
        }

        paranoia$annonce("ecran d'accueil Paranoia pose a la place de l'ecran-titre");
        return Platforms.get().createTitleScreen(ParanoiaClient.titleController());
    }

    /**
     * Une seule ligne, au premier ecran-titre.
     *
     * <p>Sans garde, elle reviendrait a chaque retour au menu. Avec, le
     * journal repond a la seule question qu'on se pose la: le mixin
     * s'applique-t-il ? Son absence totale est une reponse autant que sa
     * presence.
     */
    @Unique
    private static boolean paranoia$annonceFaite;

    @Unique
    private static void paranoia$annonce(String message) {
        if (paranoia$annonceFaite) {
            return;
        }
        paranoia$annonceFaite = true;
        LoggerFactory.getLogger("ParanoiaClient").info("[ACCUEIL] {}", message);
    }
}

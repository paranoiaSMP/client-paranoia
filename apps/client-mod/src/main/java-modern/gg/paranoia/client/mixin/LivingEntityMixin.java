package gg.paranoia.client.mixin;

import gg.paranoia.client.modules.ConsumableModule;
import net.minecraft.client.MinecraftClient;
import net.minecraft.entity.LivingEntity;
import net.minecraft.item.ItemStack;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Termine la consommation a l'instant prevu. Voir {@link ConsumableModule}.
 *
 * <p>Sur {@code tickItemStackUsage} et non sur {@code tickActiveItemStack}: la
 * sonde de la CI a lu le bytecode, et les deux ne font pas la meme chose. Le
 * decompte, le garde {@code isClient} et l'appel a {@code consumeItem} vivent
 * dans la premiere; la seconde ne compare que la pile en main et coupe l'usage.
 * S'accrocher a la seconde, comme je l'avais d'abord suppose, aurait manque
 * l'endroit ou le delai se produit.
 *
 * <pre>
 * dans  protected void tickItemStackUsage(ItemStack);
 *     15: getfield      itemUseTimeLeft
 *     31: World.isClient()      &lt;- le garde qui reserve la conclusion au serveur
 *     45: consumeItem()
 * </pre>
 *
 * <p>En {@code TAIL}: le decompte a eu lieu, et sur un client l'appel a
 * {@code consumeItem} a ete saute. C'est precisement l'instant ou l'usage
 * devrait etre fini et ne l'est pas.
 */
@Mixin(LivingEntity.class)
public abstract class LivingEntityMixin {
    @Inject(method = "tickItemStackUsage", at = @At("TAIL"))
    private void paranoia$finishUseOnTime(ItemStack stack, CallbackInfo info) {
        ConsumableModule module = ConsumableModule.instance();
        if (module == null || !module.finishesOnTime()) {
            return;
        }

        LivingEntity self = (LivingEntity) (Object) this;

        // Uniquement le joueur local, et ce seul test suffit.
        //
        // Il porte deux garanties a la fois. D'abord celle qu'on cherchait: les
        // autres entites sont pilotees par le serveur de bout en bout, anticiper
        // pour elles ne gagnerait rien et ferait diverger ce qu'on affiche
        // d'elles. Ensuite, implicitement, le cote: `client.player` est
        // l'entite du client, donc l'egalite ne peut etre vraie que la.
        //
        // Un second test sur `getWorld().isClient()` a ete essaye puis retire.
        // Il ne compilait pas -- l'un des deux symboles a bouge sur les versions
        // recentes, et la question n'a plus d'interet -- mais surtout il ne
        // faisait pas ce que son commentaire annoncait: il pretendait ecarter le
        // solo, alors qu'en solo le monde du client *est* un monde client et que
        // `isClient()` y vaut vrai. Il etait donc redondant et faux a la fois.
        //
        // Le solo n'a d'ailleurs pas besoin d'etre ecarte: sans latence, le
        // serveur integre conclut dans le meme tick, l'usage est deja termine
        // quand on arrive ici, et le test du compteur ci-dessous ne fait rien.
        MinecraftClient client = MinecraftClient.getInstance();
        if (client == null || client.player != self) {
            return;
        }

        // Le compteur doit etre a zero: c'est le tick ou la bouchee est finie.
        // Ailleurs, l'usage est en cours et doit le rester.
        if (self.getItemUseTimeLeft() > 0 || !self.isUsingItem()) {
            return;
        }

        // clearActiveItem et non consumeItem: on libere le joueur, on ne touche
        // ni a la pile, ni a la faim, ni aux effets. Le serveur les applique
        // comme avant -- la decision passe au client, la verite reste au serveur.
        self.clearActiveItem();
    }
}

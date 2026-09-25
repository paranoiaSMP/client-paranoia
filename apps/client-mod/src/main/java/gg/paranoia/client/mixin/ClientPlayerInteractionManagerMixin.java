package gg.paranoia.client.mixin;

import gg.paranoia.client.modules.CrystalCleanupModule;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.network.ClientPlayerInteractionManager;
import net.minecraft.entity.Entity;
import net.minecraft.entity.decoration.EndCrystalEntity;
import net.minecraft.entity.player.PlayerEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

/**
 * Retire le crystal frappe des l'envoi du coup. Voir {@link CrystalCleanupModule}.
 *
 * <p>Sur {@code attackEntity} et non sur {@code MinecraftClient.doAttack}: c'est
 * ici que la cible est connue et que le paquet part, alors que {@code doAttack}
 * ne rend qu'un booleen et laisserait a deviner ce qui a ete frappe.
 *
 * <p>En {@code TAIL}, donc apres l'envoi. L'ordre compte: retirer l'entite avant
 * que le paquet ne soit ecrit serait retirer la cible du code qui s'en sert.
 *
 * <p>Les signatures ont ete lues par la sonde de la CI sur 1.21.8 et 1.21.11, et
 * elles sont identiques -- {@code attackEntity(PlayerEntity, Entity)},
 * {@code ClientWorld.removeEntity(int, RemovalReason)}. Ce mixin vit donc dans
 * les sources partagees.
 */
@Mixin(ClientPlayerInteractionManager.class)
public abstract class ClientPlayerInteractionManagerMixin {
    @Inject(method = "attackEntity", at = @At("TAIL"))
    private void paranoia$removeStruckCrystal(
        PlayerEntity player, Entity target, CallbackInfo info) {
        CrystalCleanupModule module = CrystalCleanupModule.instance();
        if (module == null || !module.enabled()) {
            return;
        }

        // Uniquement les end crystals, et c'est tout l'argument: eux seuls
        // meurent de n'importe quel degat, donc eux seuls peuvent etre effaces
        // sans rien parier. Toute autre entite a des points de vie.
        if (!(target instanceof EndCrystalEntity)) {
            return;
        }

        MinecraftClient client = MinecraftClient.getInstance();
        if (client == null || client.world == null) {
            return;
        }

        // Deja parti: le paquet du serveur est arrive avant nous, ou le joueur a
        // frappe deux fois la meme image. Reappeler removeEntity sur une entite
        // absente ne casse rien, mais autant ne pas le demander.
        if (target.isRemoved()) {
            return;
        }

        // KILLED et non DISCARDED: c'est la raison que le serveur emploie pour un
        // crystal detruit, et l'etat local doit finir identique a celui qu'aurait
        // produit le paquet qu'on anticipe -- sinon on aurait remplace une attente
        // par une divergence.
        client.world.removeEntity(target.getId(), Entity.RemovalReason.KILLED);
    }
}

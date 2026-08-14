package gg.paranoia.client.net;

import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.codec.PacketCodecs;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;

/**
 * Liste des joueurs connectes qui utilisent le client Paranoia.
 *
 * <p>Elle vient du serveur, et il n'y a pas d'autre moyen. Un client Minecraft
 * ne voit pas ce que font les autres clients: rien, dans le protocole, ne dit
 * quel logiciel utilise le joueur d'en face. Seul un serveur qui recoit la
 * declaration de chacun peut la redistribuer.
 *
 * <p>Comme pour {@link PolicyPayload}, le contenu est du JSON transporte comme
 * une chaine: un plugin Paper l'emet sans dependre de Fabric, et le format peut
 * gagner des champs sans casser les clients deja installes.
 *
 * <p>Format attendu:
 * <pre>{"users": ["uuid-1", "uuid-2"]}</pre>
 */
public record UsersPayload(String json) implements CustomPayload {
    public static final CustomPayload.Id<UsersPayload> ID =
        new CustomPayload.Id<>(Identifier.of("paranoia", "users"));

    public static final PacketCodec<RegistryByteBuf, UsersPayload> CODEC =
        PacketCodecs.STRING.xmap(UsersPayload::new, UsersPayload::json).cast();

    @Override
    public CustomPayload.Id<? extends CustomPayload> getId() {
        return ID;
    }
}

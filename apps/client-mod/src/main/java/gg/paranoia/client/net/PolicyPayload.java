package gg.paranoia.client.net;

import net.minecraft.network.RegistryByteBuf;
import net.minecraft.network.codec.PacketCodec;
import net.minecraft.network.codec.PacketCodecs;
import net.minecraft.network.packet.CustomPayload;
import net.minecraft.util.Identifier;

/**
 * Politique envoyee par un serveur Paranoia a la connexion.
 *
 * <p>Le contenu est du JSON, transporte comme une simple chaine: un plugin
 * Paper peut l'emettre sans dependre d'aucun code Fabric, et le format peut
 * gagner des champs sans casser les clients deja installes.
 *
 * <p>Format attendu:
 * <pre>{"blocked": ["brightness", "colorhit"]}</pre>
 */
public record PolicyPayload(String json) implements CustomPayload {
    public static final CustomPayload.Id<PolicyPayload> ID =
        new CustomPayload.Id<>(Identifier.of("paranoia", "policy"));

    public static final PacketCodec<RegistryByteBuf, PolicyPayload> CODEC =
        PacketCodecs.STRING.xmap(PolicyPayload::new, PolicyPayload::json).cast();

    @Override
    public CustomPayload.Id<? extends CustomPayload> getId() {
        return ID;
    }
}

package gg.paranoia.client.platform;

import java.util.UUID;

/**
 * Le compte avec lequel le jeu tourne.
 *
 * <p>Recopie dans un type a nous plutot que de faire circuler la {@code Session}
 * de Minecraft: cette classe a change de paquet entre les versions ciblees
 * ({@code client.util} puis {@code client.session}), et la faire apparaitre
 * dans une signature du code partage suffirait a casser la compilation d'une
 * version sur deux.
 *
 * @param username pseudo tel que Mojang le connait, pour le handshake
 * @param profileId identifiant du compte
 * @param accessToken jeton de session du jeu -- ne doit jamais etre
 *     journalise ni quitter la machine autrement que vers Mojang
 */
public record SessionInfo(String username, UUID profileId, String accessToken) {
    /** Y a-t-il de quoi tenter une authentification ? */
    public boolean usable() {
        return username != null
            && !username.isBlank()
            && profileId != null
            && accessToken != null
            && !accessToken.isBlank();
    }
}

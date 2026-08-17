package gg.paranoia.client.net;

import java.util.UUID;

/**
 * Le compte avec lequel le jeu tourne, recopie dans un type a nous.
 *
 * <p>La {@code Session} de Minecraft n'est jamais nommee dans notre code, et
 * ce n'est pas un hasard: elle a change de paquet entre les versions ciblees
 * ({@code net.minecraft.client.util} puis {@code net.minecraft.client.session}).
 * Un seul {@code import} suffirait a casser la compilation d'une version sur
 * deux.
 *
 * <p>La sonde de CI a montre que seul le paquet avait bouge -- {@code
 * getUsername}, {@code getUuidOrNull} et {@code getAccessToken} sont
 * identiques partout. Il suffit donc de lire la session avec {@code var}, qui
 * infere le type sans le nommer, et de recopier le resultat ici. Aucune
 * methode de plateforme n'est necessaire.
 *
 * @param username pseudo tel que Mojang le connait, pour le handshake
 * @param profileId identifiant du compte
 * @param accessToken jeton de session du jeu -- ne doit jamais etre
 *     journalise, ni transmis a l'API Paranoia: il ne sert qu'a prouver a
 *     Mojang, et a lui seul, que le compte nous appartient
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

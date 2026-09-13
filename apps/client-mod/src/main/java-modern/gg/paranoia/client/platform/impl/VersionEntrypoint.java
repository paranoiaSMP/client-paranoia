package gg.paranoia.client.platform.impl;

import gg.paranoia.client.ParanoiaClient;
import net.fabricmc.api.ClientModInitializer;

/**
 * Point d'entree declare dans le {@code fabric.mod.json} de chaque version.
 * Il installe la plateforme puis passe la main au code partage.
 *
 * <p>Le nom pleinement qualifie est le meme partout, y compris en 1.21.8 qui
 * a sa propre copie: les quatre {@code fabric.mod.json} peuvent donc declarer
 * la meme classe sans savoir laquelle sera compilee.
 */
public final class VersionEntrypoint implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        ParanoiaClient.start(new PlatformImpl());
    }
}

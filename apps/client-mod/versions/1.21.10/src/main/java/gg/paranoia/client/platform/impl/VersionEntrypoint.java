package gg.paranoia.client.platform.impl;

import gg.paranoia.client.ParanoiaClient;
import net.fabricmc.api.ClientModInitializer;

/**
 * Point d'entree declare dans le {@code fabric.mod.json} de cette version.
 * Il installe la plateforme 1.21.10 puis passe la main au code partage.
 */
public final class VersionEntrypoint implements ClientModInitializer {
    @Override
    public void onInitializeClient() {
        ParanoiaClient.start(new PlatformImpl());
    }
}

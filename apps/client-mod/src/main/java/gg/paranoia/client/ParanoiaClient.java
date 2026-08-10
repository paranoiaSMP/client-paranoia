package gg.paranoia.client;

import gg.paranoia.client.hud.HudManager;
import gg.paranoia.client.menu.ClientMenuController;
import gg.paranoia.client.platform.ClientPlatform;
import gg.paranoia.client.platform.Platforms;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Demarrage partage par toutes les versions de Minecraft ciblees.
 *
 * <p>Ce n'est volontairement pas le point d'entree declare dans
 * {@code fabric.mod.json}: chaque sous-projet de version en declare un qui
 * installe sa plateforme avant d'appeler {@link #start(ClientPlatform)}.
 */
public final class ParanoiaClient {
    public static final String MOD_ID = "paranoia_client";

    private static final Logger LOGGER = LoggerFactory.getLogger("ParanoiaClient");

    private static final HudManager HUD_MANAGER = new HudManager();
    private static final ClientMenuController MENU_CONTROLLER = new ClientMenuController(HUD_MANAGER);

    private ParanoiaClient() {
    }

    public static void start(ClientPlatform platform) {
        Platforms.install(platform);

        HUD_MANAGER.bootstrapDefaultModules();
        MENU_CONTROLLER.registerHotkeys();

        LOGGER.info("Paranoia Client demarre pour Minecraft {}", platform.minecraftVersion());
    }

    public static HudManager hudManager() {
        return HUD_MANAGER;
    }
}

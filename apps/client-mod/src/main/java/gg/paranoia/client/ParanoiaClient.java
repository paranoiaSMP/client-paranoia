package gg.paranoia.client;

import gg.paranoia.client.hud.HudRegistry;
import gg.paranoia.client.hud.elements.CoordinatesHud;
import gg.paranoia.client.hud.elements.DirectionHud;
import gg.paranoia.client.menu.ParanoiaMenuScreen;
import gg.paranoia.client.platform.ClientPlatform;
import gg.paranoia.client.platform.Platforms;
import net.minecraft.client.MinecraftClient;
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
    private static final HudRegistry REGISTRY = new HudRegistry();

    private ParanoiaClient() {
    }

    public static void start(ClientPlatform platform) {
        Platforms.install(platform);

        REGISTRY.register(new CoordinatesHud());
        REGISTRY.register(new DirectionHud());

        // Les reglages sont lus apres l'enregistrement: un module absent du
        // fichier garde ses defauts, un module absent du code est ignore.
        REGISTRY.load();

        platform.registerHudRenderer((context, tickDelta) -> REGISTRY.renderInGame(context));
        platform.registerMenuKey(ParanoiaClient::toggleMenu);

        LOGGER.info(
            "Paranoia Client demarre pour Minecraft {} ({} modules)",
            platform.minecraftVersion(), REGISTRY.all().size());
    }

    private static void toggleMenu() {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client == null) {
            return;
        }

        if (client.currentScreen instanceof ParanoiaMenuScreen menu) {
            menu.close();
            return;
        }

        // On n'ouvre pas par-dessus un autre ecran: la touche serait capturee
        // pendant une saisie de texte ou dans un inventaire.
        if (client.currentScreen == null) {
            client.setScreen(new ParanoiaMenuScreen(REGISTRY));
        }
    }

    public static HudRegistry registry() {
        return REGISTRY;
    }
}

package gg.paranoia.client;

import gg.paranoia.client.hud.HudRegistry;
import gg.paranoia.client.hud.elements.ArmorHud;
import gg.paranoia.client.hud.elements.CoordinatesHud;
import gg.paranoia.client.hud.elements.DirectionHud;
import gg.paranoia.client.hud.elements.InfoHud;
import gg.paranoia.client.menu.MenuController;
import gg.paranoia.client.menu.ParanoiaMenu;
import gg.paranoia.client.platform.ClientPlatform;
import gg.paranoia.client.platform.Platforms;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.MinecraftClient;
import org.lwjgl.glfw.GLFW;
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
    private static final MenuController CONTROLLER = new MenuController(REGISTRY);

    /** Etat precedent de Maj droite, pour n'agir que sur le front d'appui. */
    private static boolean menuKeyDown;

    private ParanoiaClient() {
    }

    public static void start(ClientPlatform platform) {
        Platforms.install(platform);

        REGISTRY.register(new CoordinatesHud());
        REGISTRY.register(new DirectionHud());
        REGISTRY.register(new ArmorHud());
        REGISTRY.register(new InfoHud());

        // Les reglages sont lus apres l'enregistrement: un module absent du
        // fichier garde ses defauts, un module absent du code est ignore.
        REGISTRY.load();

        platform.registerHudRenderer(REGISTRY::renderInGame);
        ClientTickEvents.END_CLIENT_TICK.register(ParanoiaClient::pollMenuKey);

        LOGGER.info(
            "Paranoia Client demarre pour Minecraft {} ({} modules)",
            platform.minecraftVersion(), REGISTRY.all().size());
    }

    /**
     * Ouverture et fermeture sur Maj droite.
     *
     * <p>La touche est lue directement via GLFW plutot qu'avec un KeyBinding
     * Fabric: le constructeur de KeyBinding attend une categorie sous forme de
     * chaine en 1.21.8 et d'objet en 1.21.11, alors que GLFW est identique
     * partout. En contrepartie la touche n'apparait pas dans les commandes du
     * jeu -- le menu proposera son propre reglage.
     */
    private static void pollMenuKey(MinecraftClient client) {
        if (client == null || client.getWindow() == null) {
            return;
        }

        boolean down =
            GLFW.glfwGetKey(client.getWindow().getHandle(), GLFW.GLFW_KEY_RIGHT_SHIFT) == GLFW.GLFW_PRESS;

        // Front montant uniquement: sans ca le menu clignoterait tant que la
        // touche reste enfoncee.
        if (down && !menuKeyDown) {
            toggleMenu(client);
        }
        menuKeyDown = down;
    }

    private static void toggleMenu(MinecraftClient client) {
        if (client.currentScreen instanceof ParanoiaMenu) {
            client.setScreen(null);
            return;
        }

        // On n'ouvre pas par-dessus un autre ecran: la touche serait capturee
        // pendant une saisie de texte ou dans un inventaire.
        if (client.currentScreen == null) {
            client.setScreen(Platforms.get().createMenuScreen(CONTROLLER));
        }
    }

    public static HudRegistry registry() {
        return REGISTRY;
    }
}

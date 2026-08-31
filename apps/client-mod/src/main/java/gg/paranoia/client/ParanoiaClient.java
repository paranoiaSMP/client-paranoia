package gg.paranoia.client;

import gg.paranoia.client.cosmetics.CosmeticCapes;
import gg.paranoia.client.cosmetics.CosmeticTextures;
import gg.paranoia.client.cosmetics.CosmeticsRegistry;
import gg.paranoia.client.hud.HudRegistry;
import gg.paranoia.client.hud.elements.ArmorHud;
import gg.paranoia.client.hud.elements.AttackChargeHud;
import gg.paranoia.client.hud.elements.CoordinatesHud;
import gg.paranoia.client.hud.elements.CpsHud;
import gg.paranoia.client.hud.elements.DirectionHud;
import gg.paranoia.client.hud.elements.DiagnosticsHud;
import gg.paranoia.client.hud.elements.EffectsHud;
import gg.paranoia.client.hud.elements.FpsHud;
import gg.paranoia.client.hud.elements.InfoHud;
import gg.paranoia.client.hud.elements.ShieldHud;
import gg.paranoia.client.hud.elements.TotemHud;
import gg.paranoia.client.menu.MenuController;
import gg.paranoia.client.module.KeySetting;
import gg.paranoia.client.modules.BadgeModule;
import gg.paranoia.client.modules.BlockEntityCullingModule;
import gg.paranoia.client.modules.BrightnessModule;
import gg.paranoia.client.modules.ColorHitModule;
import gg.paranoia.client.modules.CrosshairModule;
import gg.paranoia.client.modules.EntityCullingModule;
import gg.paranoia.client.modules.FocusFpsModule;
import gg.paranoia.client.modules.HitIndicatorModule;
import gg.paranoia.client.modules.MenuKeyModule;
import gg.paranoia.client.modules.ParticleBudgetModule;
import gg.paranoia.client.menu.ParanoiaMenu;
import gg.paranoia.client.net.ModulePolicy;
import gg.paranoia.client.net.ParanoiaUsers;
import gg.paranoia.client.net.PolicyPayload;
import gg.paranoia.client.net.PresenceService;
import gg.paranoia.client.net.UsersPayload;
import gg.paranoia.client.net.ServerTpsTracker;
import gg.paranoia.client.platform.ClientPlatform;
import gg.paranoia.client.platform.Platforms;
import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayNetworking;
import net.fabricmc.fabric.api.networking.v1.PayloadTypeRegistry;
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
    private static final PresenceService PRESENCE = new PresenceService();

    /** Etat precedent de la touche, pour n'agir que sur le front d'appui. */
    private static boolean menuKeyDown;

    private ParanoiaClient() {
    }

    public static void start(ClientPlatform platform) {
        Platforms.install(platform);

        REGISTRY.register(new CoordinatesHud());
        REGISTRY.register(new DirectionHud());
        REGISTRY.register(new ArmorHud());
        REGISTRY.register(new InfoHud());
        REGISTRY.register(new FpsHud());
        REGISTRY.register(new CpsHud());
        REGISTRY.register(new AttackChargeHud());
        REGISTRY.register(new TotemHud());
        REGISTRY.register(new ShieldHud());
        REGISTRY.register(new EffectsHud());
        REGISTRY.register(new DiagnosticsHud());
        REGISTRY.register(new BrightnessModule());
        REGISTRY.register(new ColorHitModule());
        REGISTRY.register(new CrosshairModule());
        REGISTRY.register(new HitIndicatorModule());
        REGISTRY.register(new BadgeModule());
        REGISTRY.register(new ParticleBudgetModule());
        REGISTRY.register(new FocusFpsModule());
        REGISTRY.register(new EntityCullingModule());
        REGISTRY.register(new BlockEntityCullingModule());
        REGISTRY.register(new MenuKeyModule());

        // Les reglages sont lus apres l'enregistrement: un module absent du
        // fichier garde ses defauts, un module absent du code est ignore.
        REGISTRY.load();

        platform.registerHudRenderer(REGISTRY::renderInGame);
        ClientTickEvents.END_CLIENT_TICK.register(ParanoiaClient::pollMenuKey);
        // En debut de tick: le budget doit etre reconduit avant les naissances
        // de particules, pas apres.
        ClientTickEvents.START_CLIENT_TICK.register(client -> {
            ParticleBudgetModule.beginTick();
            EntityCullingModule.beginTick();
            BlockEntityCullingModule.beginTick();
        });
        registerPolicyChannel();

        // Source principale des badges et des cosmetiques. Elle ne demande
        // rien au serveur Minecraft, ce qui est tout l'interet: le badge
        // fonctionne aussi sur les serveurs qui ignorent notre existence.
        PRESENCE.start();

        LOGGER.info(
            "Paranoia Client demarre pour Minecraft {} ({} modules)",
            platform.minecraftVersion(), REGISTRY.all().size());
    }

    /**
     * Ouverture et fermeture du menu, sur la touche choisie dans les reglages.
     *
     * <p>La touche est lue directement via GLFW plutot qu'avec un KeyBinding
     * Fabric: le constructeur de KeyBinding attend une categorie sous forme de
     * chaine en 1.21.8 et d'objet en 1.21.11, alors que GLFW est identique
     * partout. En contrepartie la touche n'apparait pas dans les commandes du
     * jeu, d'ou le reglage propre au mod dans l'onglet Parametres.
     */
    private static void pollMenuKey(MinecraftClient client) {
        if (client == null || client.getWindow() == null) {
            return;
        }

        long window = client.getWindow().getHandle();

        // La capture d'une touche passe avant tout le reste: sans cela, lier le
        // menu a « B » l'ouvrirait au moment meme ou on appuie pour le lier.
        KeySetting.tick(window);
        if (KeySetting.isCapturing()) {
            menuKeyDown = true;
            return;
        }

        int code = MenuKeyModule.code();
        if (code == KeySetting.NONE) {
            // Ouverture au clavier desactivee ou touche deliee: on relache
            // l'etat pour ne pas declencher au moment ou elle revient.
            menuKeyDown = false;
            return;
        }

        boolean down = GLFW.glfwGetKey(window, code) == GLFW.GLFW_PRESS;

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

    /**
     * Ecoute la politique des serveurs Paranoia.
     *
     * <p>Aucun paquet ne veut dire aucune restriction: un serveur tiers n'a
     * rien a dire sur les modules, et le mod doit y rester utilisable.
     */
    private static void registerPolicyChannel() {
        PayloadTypeRegistry.playS2C().register(PolicyPayload.ID, PolicyPayload.CODEC);

        ClientPlayNetworking.registerGlobalReceiver(
            PolicyPayload.ID,
            (payload, context) -> context.client().execute(
                () -> ModulePolicy.apply(REGISTRY, payload.json())));

        // Qui, parmi les joueurs connectes, utilise le client. Un client
        // Minecraft ne peut pas le deviner: seul le serveur, qui recoit la
        // declaration de chacun, peut redistribuer la liste.
        PayloadTypeRegistry.playS2C().register(UsersPayload.ID, UsersPayload.CODEC);
        ClientPlayNetworking.registerGlobalReceiver(
            UsersPayload.ID,
            (payload, context) -> context.client().execute(
                () -> ParanoiaUsers.apply(payload.json())));

        // Sans ca, la politique et le TPS d'un serveur resteraient sur le
        // suivant. Le TPS est remis a zero ici plutot que par un mixin sur
        // onDisconnected: cette methode est heritee, on ne peut pas s'y injecter
        // depuis ClientPlayNetworkHandler.
        ClientPlayConnectionEvents.DISCONNECT.register((handler, client) -> {
            ModulePolicy.clear(REGISTRY);
            ServerTpsTracker.reset();
            // La liste des utilisateurs ne vaut que pour le serveur qui l'a
            // envoyee: la garder ferait apparaitre des badges sur le suivant.
            ParanoiaUsers.clear();
            // Les cosmetiques aussi. Les textures sont rendues dans la foulee
            // plutot qu'au bout d'une minute d'inactivite: rejoindre un autre
            // serveur ne doit pas se faire avec la memoire graphique du
            // precedent encore occupee.
            CosmeticsRegistry.clear();
            CosmeticCapes.clear();
            CosmeticTextures.clear();
        });
    }

    public static HudRegistry registry() {
        return REGISTRY;
    }
}

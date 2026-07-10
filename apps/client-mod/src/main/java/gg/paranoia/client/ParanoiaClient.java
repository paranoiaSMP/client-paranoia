package gg.paranoia.client;

import gg.paranoia.client.hud.HudManager;
import gg.paranoia.client.menu.ClientMenuController;
import net.fabricmc.api.ClientModInitializer;

public final class ParanoiaClient implements ClientModInitializer {
    private static final HudManager HUD_MANAGER = new HudManager();
    private static final ClientMenuController MENU_CONTROLLER = new ClientMenuController(HUD_MANAGER);

    @Override
    public void onInitializeClient() {
        HUD_MANAGER.bootstrapDefaultModules();
        MENU_CONTROLLER.registerHotkeys();
    }
}

package gg.paranoia.client.menu;

import gg.paranoia.client.hud.HudManager;

public final class ClientMenuController {
    private final HudManager hudManager;

    public ClientMenuController(HudManager hudManager) {
        this.hudManager = hudManager;
    }

    public void registerHotkeys() {
        // TODO: bind Right Shift to open a custom UI (HUD, perf, cosmetics, settings, profiles, macros, keybinds, system info)
        // TODO: add blur and modern transitions via custom screen renderer
    }

    public HudManager hudManager() {
        return hudManager;
    }
}

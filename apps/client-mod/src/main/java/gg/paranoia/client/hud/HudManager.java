package gg.paranoia.client.hud;

import gg.paranoia.client.hud.modules.BasicHudModule;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;

public final class HudManager {
    private final Map<String, HudModule> modules = new LinkedHashMap<>();

    public void bootstrapDefaultModules() {
        register(new BasicHudModule("fps"));
        register(new BasicHudModule("ping"));
        register(new BasicHudModule("cps"));
        register(new BasicHudModule("keystrokes"));
        register(new BasicHudModule("coordinates"));
        register(new BasicHudModule("direction"));
        register(new BasicHudModule("clock"));
        register(new BasicHudModule("armor"));
        register(new BasicHudModule("potions"));
        register(new BasicHudModule("item-counter"));
        register(new BasicHudModule("scoreboard"));
        register(new BasicHudModule("bossbar"));
        register(new BasicHudModule("durability"));
        register(new BasicHudModule("compass"));
        register(new BasicHudModule("server-info"));
    }

    public void register(HudModule module) {
        modules.put(module.id(), module);
    }

    public Collection<HudModule> all() {
        return modules.values();
    }
}

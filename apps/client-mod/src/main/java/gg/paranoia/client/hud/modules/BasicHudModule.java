package gg.paranoia.client.hud.modules;

import gg.paranoia.client.hud.HudModule;

public final class BasicHudModule implements HudModule {
    private final String id;
    private boolean enabled = true;

    public BasicHudModule(String id) {
        this.id = id;
    }

    @Override
    public String id() {
        return id;
    }

    @Override
    public boolean enabled() {
        return enabled;
    }

    @Override
    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }
}

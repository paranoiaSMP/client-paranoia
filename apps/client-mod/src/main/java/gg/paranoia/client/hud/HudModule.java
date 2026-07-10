package gg.paranoia.client.hud;

public interface HudModule {
    String id();

    boolean enabled();

    void setEnabled(boolean enabled);
}

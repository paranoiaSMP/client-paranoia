package gg.paranoia.client.platform.impl;

import gg.paranoia.client.platform.ClientPlatform;

public final class PlatformImpl implements ClientPlatform {
    @Override
    public String minecraftVersion() {
        return "1.21.8";
    }
}

package gg.paranoia.client.menu;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.Click;
import net.minecraft.text.Text;

/**
 * Ecran du menu pour Minecraft 1.21.11.
 *
 * <p>Ne contient aucune logique: il traduit les signatures d'entree de cette
 * version vers {@link MenuController}. Depuis 1.21.9, la souris n'arrive plus
 * sous forme de coordonnees et de bouton mais dans un objet {@code Click}.
 */
public final class ParanoiaMenuScreen extends Screen implements ParanoiaMenu {
    private final MenuController controller;

    public ParanoiaMenuScreen(MenuController controller) {
        super(Text.literal("Paranoia Client"));
        this.controller = controller;
    }

    @Override
    public MenuController controller() {
        return controller;
    }

    @Override
    public boolean shouldPause() {
        return false;
    }

    @Override
    protected void init() {
        controller.setViewport(width, height, textRenderer);
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        renderBackground(context, mouseX, mouseY, delta);
        controller.setViewport(width, height, textRenderer);
        controller.render(context, mouseX, mouseY);
        super.render(context, mouseX, mouseY, delta);
    }

    @Override
    public void removed() {
        controller.onClosed();
        super.removed();
    }

    @Override
    public boolean mouseClicked(Click click, boolean doubled) {
        return controller.mouseClicked(click.button()) || super.mouseClicked(click, doubled);
    }

    @Override
    public boolean mouseReleased(Click click) {
        return controller.mouseReleased() || super.mouseReleased(click);
    }
}

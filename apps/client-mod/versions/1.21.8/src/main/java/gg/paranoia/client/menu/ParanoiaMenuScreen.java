package gg.paranoia.client.menu;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

/**
 * Ecran du menu pour Minecraft 1.21.8.
 *
 * <p>Ne contient aucune logique: il traduit les signatures d'entree de cette
 * version vers {@link MenuController}. En 1.21.8 la souris arrive encore sous
 * forme de coordonnees et de numero de bouton.
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

    /**
     * Le menu ne met pas le jeu en pause: on regle ses HUD en regardant le jeu
     * tourner, et une pause ne servirait de toute facon a rien en multijoueur.
     */
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
        // renderBackground applique le flou d'arriere-plan regle dans les
        // options du jeu, ainsi que l'assombrissement des menus.
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
    public boolean mouseClicked(double mouseX, double mouseY, int button) {
        return controller.mouseClicked(button) || super.mouseClicked(mouseX, mouseY, button);
    }

    @Override
    public boolean mouseReleased(double mouseX, double mouseY, int button) {
        return controller.mouseReleased() || super.mouseReleased(mouseX, mouseY, button);
    }
}

package gg.paranoia.client.title;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

/**
 * L'ecran d'accueil Paranoia, pour Minecraft 1.21.8.
 *
 * <p>Ne contient aucune logique, comme {@code ParanoiaMenuScreen}: il traduit
 * les signatures d'entree de cette version vers {@link TitleController}. En
 * 1.21.8 la souris arrive encore sous forme de coordonnees et de numero de
 * bouton.
 *
 * <p>{@code renderBackground} n'est pas appelee: le fond de cet ecran est un
 * panorama, pas le flou des menus en jeu, et le controleur le dessine
 * lui-meme.
 */
public final class ParanoiaTitleScreen extends Screen {
    private final TitleController controller;

    public ParanoiaTitleScreen(TitleController controller) {
        super(Text.literal("Paranoia Client"));
        this.controller = controller;
    }

    /** L'ecran-titre ne se ferme pas sur Echap: il n'y a rien derriere. */
    @Override
    public boolean shouldCloseOnEsc() {
        return false;
    }

    @Override
    protected void init() {
        controller.attache(this);
        controller.setViewport(width, height, textRenderer);
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        controller.setViewport(width, height, textRenderer);
        controller.render(context, mouseX, mouseY);
        super.render(context, mouseX, mouseY, delta);
    }

    /** Le panorama couvre l'ecran: le fond par defaut n'aurait rien a y faire. */
    @Override
    public void renderBackground(DrawContext context, int mouseX, int mouseY, float delta) {
    }

    @Override
    public boolean mouseClicked(double mouseX, double mouseY, int button) {
        return controller.mouseClicked(button) || super.mouseClicked(mouseX, mouseY, button);
    }

    @Override
    public void removed() {
        controller.onClosed();
        super.removed();
    }
}

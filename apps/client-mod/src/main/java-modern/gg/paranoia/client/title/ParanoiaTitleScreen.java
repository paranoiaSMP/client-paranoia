package gg.paranoia.client.title;

import net.minecraft.client.gui.Click;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.text.Text;

/**
 * L'ecran d'accueil Paranoia, pour Minecraft 1.21.10 et au-dela.
 *
 * <p>Ne contient aucune logique, comme {@code ParanoiaMenuScreen}: il traduit
 * les signatures d'entree de cette version vers {@link TitleController}.
 * Depuis 1.21.9, la souris n'arrive plus sous forme de coordonnees et de
 * bouton mais dans un objet {@code Click}.
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

    /**
     * L'ecran-titre ne se ferme pas sur Echap: il n'y a rien derriere.
     */
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

    /**
     * Le panorama couvre l'ecran: le fond par defaut serait dessine par-dessus
     * ou dessous pour rien, et sur 1.21.9+ il declencherait un flou que le jeu
     * refuse de poser deux fois dans la meme frame.
     */
    @Override
    public void renderBackground(DrawContext context, int mouseX, int mouseY, float delta) {
    }

    @Override
    public boolean mouseClicked(Click click, boolean doubled) {
        return controller.mouseClicked(click.button()) || super.mouseClicked(click, doubled);
    }

    @Override
    public void removed() {
        controller.onClosed();
        super.removed();
    }
}

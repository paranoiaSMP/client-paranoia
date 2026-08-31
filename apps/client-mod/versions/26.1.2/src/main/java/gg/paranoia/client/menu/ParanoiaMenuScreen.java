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

    /** Voir {@link #renderBackground}: le flou ne supporte qu'un appel par frame. */
    private boolean backgroundDrawn;

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

    /**
     * Le fond flou n'est dessine qu'une fois par frame, quel que soit le nombre
     * de chemins qui le demandent.
     *
     * <p>Depuis 1.21.9, {@code Screen.renderWithTooltip} appelle deja
     * {@code renderBackground} avant {@code render}: notre propre appel en tete
     * de {@code render} produisait un second flou dans la meme frame, et le jeu
     * jette alors {@code Can only blur once per frame} -- le menu faisait
     * planter le jeu des l'ouverture.
     *
     * <p>Plutot que de retirer simplement l'appel -- ce qui priverait 1.21.8 de
     * son fond, personne ne l'y appelant a notre place -- on laisse les deux
     * chemins le demander et on ignore le second.
     */
    @Override
    public void renderBackground(DrawContext context, int mouseX, int mouseY, float delta) {
        if (backgroundDrawn) {
            return;
        }

        backgroundDrawn = true;
        super.renderBackground(context, mouseX, mouseY, delta);
    }

    @Override
    public void render(DrawContext context, int mouseX, int mouseY, float delta) {
        // Sans effet si le jeu s'en est deja charge pour cette frame.
        renderBackground(context, mouseX, mouseY, delta);
        controller.setViewport(width, height, textRenderer);
        controller.render(context, mouseX, mouseY);
        super.render(context, mouseX, mouseY, delta);

        // La frame est finie: le fond de la suivante reste a dessiner.
        backgroundDrawn = false;
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

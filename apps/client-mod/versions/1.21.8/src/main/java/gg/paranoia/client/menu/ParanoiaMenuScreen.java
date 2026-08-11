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

    /**
     * Le fond flou n'est dessine qu'une fois par frame, quel que soit le nombre
     * de chemins qui le demandent.
     *
     * <p>Depuis 1.21.9, {@code Screen.renderWithTooltip} appelle deja
     * {@code renderBackground} avant {@code render}: notre propre appel en tete
     * de {@code render} produisait un second flou dans la meme frame, et le jeu
     * jette alors {@code Can only blur once per frame} -- le menu faisait
     * planter le jeu des l'ouverture. En 1.21.8 personne ne l'appelle pour nous
     * et il faut bien le faire.
     *
     * <p>Plutot que de dependre de la version -- Mojang a deja deplace cet appel
     * une fois, rien ne dit qu'il ne bougera plus -- on laisse les deux chemins
     * demander le fond et on ignore le second.
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
    public boolean mouseClicked(double mouseX, double mouseY, int button) {
        return controller.mouseClicked(button) || super.mouseClicked(mouseX, mouseY, button);
    }

    @Override
    public boolean mouseReleased(double mouseX, double mouseY, int button) {
        return controller.mouseReleased() || super.mouseReleased(mouseX, mouseY, button);
    }
}

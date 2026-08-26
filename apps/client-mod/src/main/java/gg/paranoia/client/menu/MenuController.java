package gg.paranoia.client.menu;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.hud.HudRegistry;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

/**
 * Le mod menu. Deux modes, et un aiguillage entre les deux.
 *
 * <p>{@code FENETRE} est ce qu'on voit en ouvrant: bandeau, filtres et grille de
 * cartes. {@code EDITION} efface la fenetre et rend les HUD deplacables. Les
 * separer vient d'un constat simple: tant que la fenetre couvrait l'ecran, on
 * placait ses HUD sans voir le resultat.
 *
 * <p>Cette classe ne dessine rien elle-meme. Elle tient l'etat, oriente les
 * clics, et laisse {@link ModuleWindow} et {@link HudEditor} faire le rendu.
 */
public final class MenuController {
    private enum Mode {
        FENETRE,
        EDITION,
    }

    private final HudRegistry registry;
    private final ModuleWindow window;
    private final HudEditor editor;

    private Mode mode = Mode.FENETRE;

    // Dimensions et police de l'ecran hote, rafraichies a chaque image.
    private int width;
    private int height;
    private TextRenderer font;

    // Derniere position connue du curseur, relevee au rendu.
    //
    // On ne lit pas la position portee par l'evenement souris: en 1.21.11 un
    // clic arrive dans un objet Click qui porte le point d'appui, pas le point
    // courant, ce qui ferait sauter tout deplacement. Le rendu, lui, recoit la
    // position courante avec la meme signature sur les deux versions.
    private int mouseX;
    private int mouseY;

    public MenuController(HudRegistry registry) {
        this.registry = registry;
        this.window = new ModuleWindow(registry);
        this.editor = new HudEditor(registry);
    }

    /** Appele par l'ecran de la version avant tout rendu ou toute entree. */
    public void setViewport(int width, int height, TextRenderer font) {
        this.width = width;
        this.height = height;
        this.font = font;
    }

    /**
     * Fermer le menu vaut validation: le joueur ne devrait pas avoir a penser a
     * enregistrer ce qu'il vient de deplacer.
     */
    public void onClosed() {
        registry.save();
        mode = Mode.FENETRE;
        window.reset();
        editor.reset();
    }

    // ------------------------------------------------------------------ rendu

    public void render(DrawContext context, int mouseX, int mouseY) {
        this.mouseX = mouseX;
        this.mouseY = mouseY;

        // Le menu dessine les HUD lui-meme: c'est une image a part entiere, et
        // les instantanes du rendu en jeu ne valent plus pour elle.
        HudElement.beginFrame();

        if (mode == Mode.EDITION) {
            editor.render(context, font, width, height, mouseX, mouseY);
            return;
        }

        // Les HUD sont dessines avant la fenetre: l'assombrissement qu'elle pose
        // les fait passer a l'arriere-plan sans les faire disparaitre. On voit
        // donc ce qu'on active, en direct, pendant qu'on l'active.
        for (HudElement element : registry.hudElements()) {
            if (element.enabled()) {
                HudRegistry.draw(context, font, element, width, height);
            }
        }

        window.render(context, font, width, height, mouseX, mouseY);
    }

    // ----------------------------------------------------------------- souris

    public boolean mouseClicked(int button) {
        if (mode == Mode.EDITION) {
            if (editor.mouseClicked(font, width, height, mouseX, mouseY, button)) {
                mode = Mode.FENETRE;
            } else if (button == 1 && editor.selected() != null) {
                // Clic droit sur un HUD: ses reglages, comme l'annonce la barre.
                mode = Mode.FENETRE;
                window.openOptions(editor.selected());
            }
            return true;
        }

        if (window.mouseClicked(font, mouseX, mouseY, button)) {
            mode = Mode.EDITION;
            editor.reset();
            return true;
        }

        if (window.pollCloseRequest()) {
            close();
        }
        return true;
    }

    public boolean mouseReleased() {
        return mode == Mode.EDITION && editor.mouseReleased();
    }

    private void close() {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client != null) {
            // Passe par setScreen plutot que par l'ecran lui-meme: le controleur
            // ne connait pas la classe d'ecran, qui differe selon la version.
            client.setScreen(null);
        }
    }
}

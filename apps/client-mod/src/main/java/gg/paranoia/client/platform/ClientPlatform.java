package gg.paranoia.client.platform;

import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;

/**
 * Ce que le code partage ne peut pas ecrire une seule fois.
 *
 * <p>Les sources de {@code src/main/java} sont recompilees dans chaque
 * sous-projet {@code versions/<mc>}, contre le jar Minecraft de cette version:
 * elles peuvent donc manipuler directement {@code DrawContext} ou {@code Screen}
 * sans passer par une abstraction. Seul ce qui a change de nom ou de signature
 * entre les versions ciblees passe par ici.
 *
 * <p>Chaque ajout a cette interface est un cout paye une fois par version: elle
 * doit rester petite.
 */
public interface ClientPlatform {
    /** Version de Minecraft pour laquelle ce jar a ete compile, ex. "1.21.8". */
    String minecraftVersion();

    /**
     * Branche le rendu des HUD en jeu. Le nom du callback Fabric a change entre
     * les versions ciblees, l'enregistrement appartient donc a la version.
     */
    void registerHudRenderer(HudRenderer renderer);

    /**
     * Enregistre l'ouverture du menu sur Maj droite. La construction d'un
     * {@code KeyBinding} depend de la version; la detection d'appui, elle, reste
     * dans le code partage.
     */
    void registerMenuKey(Runnable onPressed);

    /**
     * Flou d'arriere-plan du menu. Minecraft l'applique deja sur ses propres
     * ecrans, mais pas par le meme chemin d'une version a l'autre.
     */
    void renderMenuBackdrop(Screen screen, DrawContext context, int mouseX, int mouseY, float delta);

    /**
     * Mise a l'echelle d'un HUD autour de son coin superieur gauche.
     *
     * <p>Isole ici parce que la pile de matrices a ete remplacee entre les
     * versions ciblees: c'est la seule facon de garder le dessin des HUD dans le
     * code partage.
     */
    void pushScale(DrawContext context, float scale, int pivotX, int pivotY);

    void popScale(DrawContext context);
}

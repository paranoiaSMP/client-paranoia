package gg.paranoia.client.platform;

import gg.paranoia.client.menu.MenuController;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;

/**
 * Ce que le code partage ne peut pas ecrire une seule fois.
 *
 * <p>Les sources de {@code src/main/java} sont recompilees dans chaque
 * sous-projet {@code versions/<mc>}, contre le jar Minecraft de cette version:
 * elles peuvent donc manipuler directement {@code DrawContext} ou dessiner le
 * menu sans abstraction. Seul ce qui a change de nom ou de signature entre les
 * versions ciblees passe par ici.
 *
 * <p>La liste s'est reduite en la confrontant au compilateur: le raccourci
 * clavier est parti (lu directement via GLFW, identique partout) et le flou est
 * passe dans l'ecran de chaque version. Ce qui reste diverge reellement.
 */
public interface ClientPlatform {
    /** Version de Minecraft pour laquelle ce jar a ete compile, ex. "1.21.8". */
    String minecraftVersion();

    /**
     * Branche le rendu des HUD en jeu. Le compteur d'images passe au callback
     * Fabric n'expose pas les memes methodes selon la version, l'enregistrement
     * appartient donc a la version.
     */
    void registerHudRenderer(HudRenderer renderer);

    /**
     * Construit l'ecran du menu.
     *
     * <p>C'est la divergence la plus profonde entre les versions ciblees:
     * {@code Screen} recoit ses clics sous forme de {@code (x, y, bouton)} en
     * 1.21.8, et d'un objet {@code Click} en 1.21.11. L'ecran de chaque version
     * traduit ces signatures vers {@link MenuController}, ou vit toute la
     * logique commune.
     */
    Screen createMenuScreen(MenuController controller);

    /**
     * Mise a l'echelle d'un HUD autour d'un point.
     *
     * <p>Isole ici parce que la pile de matrices est passee d'un MatrixStack 3D
     * a un Matrix3x2fStack 2D: c'est la seule facon de garder le dessin des HUD
     * dans le code partage.
     */
    void pushScale(DrawContext context, float scale, int pivotX, int pivotY);

    void popScale(DrawContext context);
}

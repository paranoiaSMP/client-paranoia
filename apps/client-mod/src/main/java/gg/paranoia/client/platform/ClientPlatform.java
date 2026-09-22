package gg.paranoia.client.platform;

import gg.paranoia.client.menu.MenuController;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.text.Style;
import net.minecraft.util.Identifier;

import java.util.UUID;

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

    /**
     * Identifiant du joueur derriere une entree de la liste des joueurs.
     *
     * <p>{@code GameProfile} vient d'authlib, pas de Minecraft, et il est passe
     * de classe a record entre 1.21.8 et 1.21.10: {@code getId()} d'un cote,
     * {@code id()} de l'autre. Une divergence hors du code de Mojang, mais une
     * divergence quand meme.
     */
    UUID profileId(PlayerListEntry entry);

    /**
     * Charge une image telechargee dans le jeu et rend son identifiant.
     *
     * <p>Deux choses divergent ici. Le constructeur de
     * {@code NativeImageBackedTexture} a gagne une etiquette, passee en
     * premier, dans les versions recentes -- une chaine de journalisation, mais
     * qui change la signature. Et {@code Identifier} se construit depuis un
     * espace de noms et un chemin dont la fabrique a change de nom au fil des
     * versions. Le reste du cache est commun.
     *
     * <p>A appeler depuis le fil de rendu uniquement: c'est un envoi vers la
     * carte graphique.
     *
     * @param path chemin dans l'espace de noms Paranoia, deja normalise.
     */
    Identifier registerCosmeticTexture(String path, NativeImage image);

    /** Libere la texture et sa memoire graphique. Fil de rendu uniquement. */
    void unregisterCosmeticTexture(Identifier id);

    /**
     * Un style qui impose une police au texte.
     *
     * <p>{@code Style.withFont} prenait un {@code Identifier} en 1.21.8; a
     * partir de 1.21.10 il prend un {@code StyleSpriteSource}, type qui
     * n'existe pas dans l'autre version -- le style ne pointe plus une police
     * mais une source de sprites, dont une police n'est qu'un cas. La police ne
     * se choisit pourtant pas autrement: Minecraft la lit sur le style du
     * {@code Text}, jamais sur le {@code TextRenderer} qui le dessine.
     *
     * <p>Rendre {@code Style.EMPTY} reste une reponse valable: le texte sort
     * alors dans la police du jeu. C'est la sortie de secours d'une version
     * dont on ne saurait pas designer une police.
     */
    Style fontStyle(Identifier font);

    /**
     * Cette version sait-elle conclure une consommation cote client ?
     *
     * <p>Le mixin qui le fait s'accroche a {@code tickItemStackUsage}, et vit
     * dans {@code src/main/java-modern}: il n'est donc compile, et declare, que
     * sur les versions qui partagent ce tronc. Sans cette methode, le module
     * apparaitrait dans le menu de toutes les versions et ne ferait rien sur
     * l'une d'elles -- un reglage qui mentirait au joueur.
     *
     * <p>Faux par defaut, et c'est le bon sens de la valeur: une version qu'on
     * n'a pas outillee ne doit pas promettre ce qu'elle ne tient pas. C'est
     * l'inverse du choix habituel, ou le defaut est la capacite; ici la
     * prudence vaut mieux, parce qu'un module inerte se remarque moins qu'une
     * erreur de compilation.
     */
    default boolean supportsLocalUseCompletion() {
        return false;
    }
}

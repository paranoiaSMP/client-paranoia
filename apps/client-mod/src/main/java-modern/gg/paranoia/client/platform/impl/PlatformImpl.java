package gg.paranoia.client.platform.impl;

import gg.paranoia.client.menu.MenuController;
import gg.paranoia.client.menu.ParanoiaMenuScreen;
import gg.paranoia.client.platform.ClientPlatform;
import gg.paranoia.client.platform.HudRenderer;
import net.fabricmc.fabric.api.client.rendering.v1.HudRenderCallback;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.network.PlayerListEntry;
import net.minecraft.client.texture.NativeImage;
import net.minecraft.client.texture.NativeImageBackedTexture;
import net.minecraft.text.Style;
import net.minecraft.util.Identifier;

import java.util.UUID;

/**
 * Branchements de Minecraft, pour toutes les versions sauf 1.21.8.
 *
 * <p>Ce fichier existait en trois exemplaires identiques au caractere pres --
 * 1.21.10, 1.21.11 et 26.1.2 -- que seul le numero de version distinguait.
 * Corriger un defaut ici demandait donc trois modifications semblables, avec
 * le risque d'en oublier une. Seule 1.21.8 diverge reellement, et elle garde
 * sa propre copie.
 */
public final class PlatformImpl implements ClientPlatform {
    /**
     * La version de Minecraft, demandee au chargeur plutot qu'ecrite en dur.
     *
     * <p>C'etait la seule chose qui differait entre les trois copies, donc le
     * seul obstacle a leur fusion. La lire est aussi plus juste: une chaine
     * ecrite a la main peut mentir, celle-ci vient du jeu qui tourne.
     *
     * <p>{@code FabricLoader} appartient au chargeur et non a Minecraft: son
     * API ne bouge pas d'une version du jeu a l'autre, contrairement a tout ce
     * que ce fichier touche par ailleurs. Le code partage s'en sert deja pour
     * trouver le dossier de configuration.
     */
    @Override
    public String minecraftVersion() {
        return FabricLoader.getInstance()
            .getModContainer("minecraft")
            .map(container -> container.getMetadata().getVersion().getFriendlyString())
            .orElse("inconnue");
    }

    @Override
    public void registerHudRenderer(HudRenderer renderer) {
        // Le second parametre est le compteur d'images: inutilise, et ses
        // methodes different selon la version, donc on ne le touche pas.
        HudRenderCallback.EVENT.register((context, tickCounter) -> renderer.render(context));
    }

    @Override
    public Screen createMenuScreen(MenuController controller) {
        return new ParanoiaMenuScreen(controller);
    }

    @Override
    public void pushScale(DrawContext context, float scale, int pivotX, int pivotY) {
        // getMatrices() renvoie un Matrix3x2fStack (JOML, 2D): pushMatrix/popMatrix
        // et des translate/scale a deux composantes, pas le MatrixStack 3D d'avant.
        context.getMatrices().pushMatrix();
        context.getMatrices().translate(pivotX, pivotY);
        context.getMatrices().scale(scale, scale);
    }

    @Override
    public void popScale(DrawContext context) {
        context.getMatrices().popMatrix();
    }

    @Override
    public UUID profileId(PlayerListEntry entry) {
        // GameProfile est un record dans cette version.
        return entry.getProfile().id();
    }

    @Override
    public Identifier registerCosmeticTexture(String path, NativeImage image) {
        Identifier id = Identifier.of("paranoia", path);
        // L'etiquette est une chaine de journalisation, evaluee paresseusement
        // par le jeu quand il decrit ses textures.
        MinecraftClient.getInstance().getTextureManager()
            .registerTexture(id, new NativeImageBackedTexture(id::toString, image));
        return id;
    }

    @Override
    public void unregisterCosmeticTexture(Identifier id) {
        MinecraftClient.getInstance().getTextureManager().destroyTexture(id);
    }

    /**
     * La police du jeu, faute de savoir designer l'autre.
     *
     * <p>{@code withFont} ne prend plus un identifiant mais un
     * {@code StyleSpriteSource}, et rien dans ce depot ne dit comment on en
     * fabrique un: le compilateur est en CI, pas ici. Deviner la fabrique
     * couterait un aller-retour de build par essai, pour un resultat qu'on
     * n'aurait de toute facon pas verifie -- une signature non confirmee par la
     * CI n'est pas une signature verifiee.
     *
     * <p>La sonde de {@code build-mod.yml} affiche desormais {@code Style} et
     * {@code StyleSpriteSource} sur chaque version: la vraie signature sera
     * dans le journal du prochain build, et cette methode pourra la suivre.
     * D'ici la, le choix de police reste sans effet sur ces versions -- le HUD
     * s'affiche dans la police du jeu, pas dans une police cassee.
     */
    @Override
    public Style fontStyle(Identifier font) {
        return Style.EMPTY;
    }
}

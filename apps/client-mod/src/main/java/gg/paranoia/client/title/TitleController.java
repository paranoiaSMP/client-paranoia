package gg.paranoia.client.title;

import gg.paranoia.client.ParanoiaClient;
import gg.paranoia.client.menu.MenuTheme;
import gg.paranoia.client.menu.ModuleIcons;
import gg.paranoia.client.modules.MenuAccueilModule;
import gg.paranoia.client.platform.Platforms;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.CubeMapRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.gui.RotatingCubeMapRenderer;
import net.minecraft.client.gui.screen.ConfirmLinkScreen;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.multiplayer.MultiplayerScreen;
import net.minecraft.client.gui.screen.option.OptionsScreen;
import net.minecraft.client.gui.screen.world.SelectWorldScreen;

import java.util.ArrayList;
import java.util.List;

/**
 * L'ecran d'accueil Paranoia: tout ce qu'il affiche, et tout ce qu'il fait.
 *
 * <p>Meme partage que pour le mod menu: cette classe est commune a toutes les
 * versions de Minecraft, et l'ecran de chaque version ne fait que lui passer
 * les entrees. Elle le peut parce qu'elle ne se sert que de ce qui ne bouge
 * pas -- {@code fill}, {@code drawText}, et les trois constructeurs d'ecrans
 * du jeu, verifies identiques de 1.21.8 a 1.21.11 par la sonde de
 * {@code build-mod.yml}.
 *
 * <p>Le panorama est la seule exception, et elle n'en est pas une: la sonde
 * montre {@code CubeMapRenderer(Identifier)} et
 * {@code RotatingCubeMapRenderer.render(DrawContext, int, int, boolean)} avec
 * exactement la meme signature sur les versions ciblees. Le jour ou elle
 * changera, c'est la sonde qui le dira, pas un plantage chez un joueur.
 */
public final class TitleController {
    /**
     * La boutique. Le mod ne la connait pas autrement: elle vit sur le site,
     * pas dans l'API, et le launcher l'ouvre deja dans le navigateur du
     * systeme pour que le gestionnaire de mots de passe et les moyens de
     * paiement enregistres soient la. En jeu, le passage par
     * {@link ConfirmLinkScreen} est ce que fait Minecraft pour tout lien: le
     * joueur voit l'adresse avant que quoi que ce soit s'ouvre.
     *
     * <p>Surchargeable par la meme propriete systeme que l'API, pour les
     * essais.
     */
    private static final String BOUTIQUE =
        System.getProperty("paranoia.boutique", "https://paranoiastudio.fr/boutique").trim();

    /** Ce qu'un bouton declenche. */
    public enum Action {
        SOLO,
        MULTI,
        PARANOIA,
        BOUTIQUE,
        OPTIONS,
        TEINTE,
        PANORAMA,
        QUITTER,
    }

    /**
     * Un bouton pose: sa place, son texte, et ce qu'il fait.
     *
     * <p>{@code icone} n'est rempli que pour les carres du bas, {@code label}
     * que pour les barres. Un bouton n'est jamais les deux.
     */
    private record Bouton(
        Action action, String label, String icone,
        int x, int y, int w, int h, boolean accent) {
    }

    private static final String[] PHRASES = {
        "Tourne plus vite que prevu",
        "Compte les images, pas les promesses",
        "Six mods, zero folklore",
        "Le FPS n'est pas une opinion",
        "Sans publicite, sans surprise",
        "Fabrique a Paranoia Studio",
    };

    private final List<Bouton> boutons = new ArrayList<>();

    private Screen ecran;
    private int width;
    private int height;
    private TextRenderer font;
    private int mouseX;
    private int mouseY;

    // Le panorama en service, et le choix qui l'a produit. Reconstruit quand le
    // second change, et pas a chaque image: un CubeMapRenderer tient un tampon
    // GPU, en fabriquer un par image les accumulerait.
    private Panorama monte;
    private CubeMapRenderer cube;
    private RotatingCubeMapRenderer panorama;

    /** L'ecran hote, pour les ecrans du jeu qui veulent savoir d'ou l'on vient. */
    public void attache(Screen ecran) {
        this.ecran = ecran;
    }

    public void setViewport(int width, int height, TextRenderer font) {
        this.width = width;
        this.height = height;
        this.font = font;
    }

    /**
     * Rend le tampon GPU du panorama.
     *
     * <p>Appele quand l'ecran disparait. Sans cela, chaque retour au menu --
     * apres une partie, apres les options -- en laisserait un derriere lui.
     */
    public void onClosed() {
        if (cube != null) {
            cube.close();
            cube = null;
            panorama = null;
            monte = null;
        }
    }

    // ------------------------------------------------------------------ rendu

    public void render(DrawContext context, int mouseX, int mouseY) {
        this.mouseX = mouseX;
        this.mouseY = mouseY;

        MinecraftClient client = MinecraftClient.getInstance();
        Teinte teinte = teinte();

        fond(context, client);
        dispose();
        logo(context, teinte);

        for (Bouton bouton : boutons) {
            dessine(context, bouton, teinte);
        }

        pastilleCompte(context, client, teinte);
        pied(context);
    }

    /** Le panorama, puis un voile: sans lui le texte clair passe sur un ciel clair. */
    private void fond(DrawContext context, MinecraftClient client) {
        RotatingCubeMapRenderer rendu = panorama(client);
        if (rendu != null) {
            rendu.render(context, width, height, true);
        }
        context.fill(0, 0, width, height, MenuTheme.BACKDROP);
    }

    private RotatingCubeMapRenderer panorama(MinecraftClient client) {
        Panorama choisi = panoramaChoisi();
        if (panorama != null && choisi == monte) {
            return panorama;
        }

        if (cube != null) {
            cube.close();
        }

        cube = new CubeMapRenderer(choisi.cubeMap());
        cube.registerTextures(client.getTextureManager());
        panorama = new RotatingCubeMapRenderer(cube);
        panorama.registerTextures(client.getTextureManager());
        monte = choisi;
        return panorama;
    }

    private void logo(DrawContext context, Teinte teinte) {
        int milieu = width / 2;
        int haut = Math.max(24, height / 2 - 96);

        // Trois fois la taille du texte, autour du point ou il doit tomber: la
        // police du jeu n'a qu'un corps, et c'est la seule facon d'avoir un
        // titre qui en soit un.
        String titre = "PARANOIA";
        int largeur = font.getWidth(titre);
        Platforms.get().pushScale(context, 3.0F, milieu - (largeur * 3) / 2, haut);
        MenuTheme.text(context, font, titre, 0, 0, teinte.argb());
        Platforms.get().popScale(context);

        MenuAccueilModule reglages = MenuAccueilModule.instance();
        if (reglages == null || reglages.splash()) {
            String phrase = PHRASES[(int) (System.currentTimeMillis() / 86_400_000L % PHRASES.length)];
            MenuTheme.centered(context, font, phrase, 0, width, haut + 34, MenuTheme.TEXT_DIM);
        }
    }

    private void dessine(DrawContext context, Bouton bouton, Teinte teinte) {
        boolean survole = MenuTheme.inside(
            mouseX, mouseY, bouton.x(), bouton.y(), bouton.w(), bouton.h());

        int fond = bouton.accent()
            ? (survole ? teinte.argb() : teinte.voile())
            : (survole ? MenuTheme.CARD_HOVER : MenuTheme.CARD);
        MenuTheme.panel(context, bouton.x(), bouton.y(), bouton.w(), bouton.h(), fond);
        MenuTheme.outline(context, bouton.x(), bouton.y(), bouton.w(), bouton.h(),
            survole ? teinte.argb() : MenuTheme.CARD_BORDER);

        if (bouton.icone() != null) {
            // Deux pixels d'ecran par pixel de la grille: l'icone fait alors
            // 18 de cote dans un carre de 22, soit deux de marge tout autour.
            int pixel = 2;
            int cote = ModuleIcons.size(pixel);
            ModuleIcons.draw(context, bouton.icone(),
                bouton.x() + (bouton.w() - cote) / 2,
                bouton.y() + (bouton.h() - cote) / 2,
                pixel,
                survole ? teinte.argb() : MenuTheme.TEXT);
            return;
        }

        MenuTheme.centered(context, font, bouton.label(), bouton.x(), bouton.w(),
            bouton.y() + (bouton.h() - font.fontHeight) / 2 + 1, MenuTheme.TEXT);
    }

    /** Qui est connecte, en haut a gauche, comme dans le launcher. */
    private void pastilleCompte(DrawContext context, MinecraftClient client, Teinte teinte) {
        String pseudo = client.getSession().getUsername();
        int largeur = Math.min(140, font.getWidth(pseudo) + 16);
        MenuTheme.panel(context, 8, 8, largeur, 18, MenuTheme.CARD);
        MenuTheme.outline(context, 8, 8, largeur, 18, MenuTheme.CARD_BORDER);
        context.fill(13, 15, 17, 19, teinte.argb());
        MenuTheme.text(context, font, MenuTheme.fit(font, pseudo, largeur - 16),
            21, 13, MenuTheme.TEXT);
    }

    private void pied(DrawContext context) {
        MenuTheme.text(context, font,
            "Paranoia Client - Minecraft " + Platforms.get().minecraftVersion(),
            8, height - 14, MenuTheme.TEXT_DIM);
        MenuTheme.right(context, font, "Non affilie a Mojang",
            0, width - 8, height - 14, MenuTheme.TEXT_DIM);
    }

    // --------------------------------------------------------------- position

    /**
     * Repose les boutons pour la taille courante.
     *
     * <p>A chaque image, et non une fois: la fenetre se redimensionne, et une
     * disposition calculee une seule fois laisserait les zones cliquables la ou
     * les boutons ne sont plus.
     */
    private void dispose() {
        boutons.clear();

        int largeBarre = 220;
        int hauteurBarre = 22;
        int espace = 6;
        int gauche = (width - largeBarre) / 2;
        int y = Math.max(72, height / 2 - 18);

        boutons.add(new Bouton(Action.SOLO, "Solo", null,
            gauche, y, largeBarre, hauteurBarre, false));
        y += hauteurBarre + espace;
        boutons.add(new Bouton(Action.MULTI, "Multijoueur", null,
            gauche, y, largeBarre, hauteurBarre, false));
        y += hauteurBarre + espace;

        int demi = (largeBarre - espace) / 2;
        boutons.add(new Bouton(Action.PARANOIA, "Paranoia", null,
            gauche, y, demi, hauteurBarre, false));
        boutons.add(new Bouton(Action.BOUTIQUE, "Boutique", null,
            gauche + demi + espace, y, largeBarre - demi - espace, hauteurBarre, true));

        // Les carres, sous les barres, centres comme elles.
        int cote = 22;
        Action[] carres = {
            Action.OPTIONS, Action.PARANOIA, Action.TEINTE, Action.PANORAMA, Action.QUITTER,
        };
        String[] icones = {
            "titre-options", "titre-paranoia", "titre-teinte", "titre-panorama", "titre-quitter",
        };

        int total = carres.length * cote + (carres.length - 1) * espace;
        int x = (width - total) / 2;
        int bas = y + hauteurBarre + 14;
        for (int i = 0; i < carres.length; i++) {
            boutons.add(new Bouton(carres[i], null, icones[i], x, bas, cote, cote, false));
            x += cote + espace;
        }
    }

    // ----------------------------------------------------------------- souris

    public boolean mouseClicked(int button) {
        if (button != 0) {
            return false;
        }

        for (Bouton bouton : boutons) {
            if (MenuTheme.inside(mouseX, mouseY, bouton.x(), bouton.y(), bouton.w(), bouton.h())) {
                execute(bouton.action());
                return true;
            }
        }
        return false;
    }

    private void execute(Action action) {
        MinecraftClient client = MinecraftClient.getInstance();

        switch (action) {
            case SOLO -> client.setScreen(new SelectWorldScreen(ecran));
            case MULTI -> client.setScreen(new MultiplayerScreen(ecran));
            case PARANOIA -> client.setScreen(
                Platforms.get().createMenuScreen(ParanoiaClient.controller()));
            case BOUTIQUE -> ConfirmLinkScreen.open(ecran, BOUTIQUE, true);
            case OPTIONS -> client.setScreen(new OptionsScreen(ecran, client.options));
            // Les deux seuls boutons qui ne quittent pas l'ecran: ils changent
            // ce qu'on est en train de regarder, et le resultat se voit sur
            // place. Les envoyer dans un sous-menu pour cela serait absurde.
            case TEINTE -> {
                MenuAccueilModule reglages = MenuAccueilModule.instance();
                if (reglages != null) {
                    reglages.teinteSuivante();
                }
            }
            case PANORAMA -> {
                MenuAccueilModule reglages = MenuAccueilModule.instance();
                if (reglages != null) {
                    reglages.panoramaSuivant();
                }
            }
            case QUITTER -> client.scheduleStop();
        }
    }

    /*
     * Les deux reglages, avec leur valeur par defaut quand le module n'est pas
     * la.
     *
     * <p>Il y est toujours a l'usage -- l'ecran n'existe que parce que le
     * module l'a demande. Mais le pire echec imaginable ici est un plantage de
     * l'ecran-titre, c'est-a-dire un jeu qui ne demarre plus du tout, et une
     * valeur par defaut coute une ligne.
     */

    private Teinte teinte() {
        MenuAccueilModule reglages = MenuAccueilModule.instance();
        return reglages == null ? Teinte.AMETHYSTE : reglages.teinte();
    }

    private Panorama panoramaChoisi() {
        MenuAccueilModule reglages = MenuAccueilModule.instance();
        return reglages == null ? Panorama.SPAWN : reglages.panorama();
    }
}

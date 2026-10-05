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
     * Un bouton pose: sa place, ce qu'il montre, et ce qu'il fait.
     *
     * <p>Une barre porte une icone <em>et</em> un texte, centres ensemble --
     * c'est la disposition du modele. Un carre du bas ne porte qu'une icone,
     * et son {@code label} est nul.
     */
    private record Bouton(
        Action action, String label, String icone,
        int x, int y, int w, int h, boolean boutique) {
    }

    /*
     * Les mesures, relevees sur le modele plutot qu'approchees a l'oeil.
     *
     * <p>La capture fait 1917 de large pour une interface a l'echelle 2: tout
     * ce qui suit est donc la moitie de ce qu'on y mesure. La barre y fait 398
     * sur 40 avec 8 d'ecart, soit 200 sur 20 avec 4 -- exactement les
     * dimensions d'un bouton de Minecraft. Le modele ne les a pas inventees,
     * il les a rhabillees, et il n'y a aucune raison de s'en ecarter.
     */

    /** Barre pleine largeur: Solo, Multijoueur. */
    private static final int BARRE_L = 200;
    private static final int BARRE_H = 20;
    /** Ecart vertical entre deux barres, et horizontal entre les deux demies. */
    private static final int ECART = 4;
    /** Demi-barre: la rangee du bas en porte deux. */
    private static final int DEMI_L = (BARRE_L - ECART) / 2;
    /** Cote de la zone cliquable d'un carre du bas, et pas entre deux centres. */
    private static final int CARRE = 20;
    private static final int PAS_CARRE = 23;

    /*
     * Les couleurs, relevees elles aussi. Le fond d'une barre rend (19, 21, 27)
     * au-dessus d'un panorama clair comme au-dessus d'un panorama sombre: il
     * est donc opaque, et non un noir translucide comme on pourrait le croire.
     */
    private static final int BARRE = 0xFF13151B;
    private static final int BARRE_SURVOL = 0xFF1E2129;
    private static final int BARRE_BORD = 0x1FE9E9ED;
    /** La boutique garde sa couleur propre: c'est ce qui la distingue. */
    private static final int VERT_FOND = 0xFF101E12;
    private static final int VERT_FOND_SURVOL = 0xFF17301C;
    private static final int VERT_BORD = 0xFF2A4A38;
    private static final int VERT = 0xFF5BD98A;

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
        // Le modele centre son logo 76 au-dessus du milieu de l'ecran, soit
        // 45 au-dessus de la premiere barre.
        int haut = Math.max(12, height / 2 - 88);

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

        // Un carre du bas n'a pas de fond au repos: sur le modele, seules les
        // icones flottent au-dessus du panorama. Le fond n'apparait qu'au
        // survol, et c'est lui qui dit que la zone cliquable est plus large
        // que l'icone.
        if (bouton.label() == null) {
            if (survole) {
                MenuTheme.panel(context, bouton.x(), bouton.y(), bouton.w(), bouton.h(),
                    MenuTheme.ROW_HOVER);
            }
            ModuleIcons.draw(context, bouton.icone(),
                bouton.x() + (bouton.w() - ModuleIcons.size(1)) / 2,
                bouton.y() + (bouton.h() - ModuleIcons.size(1)) / 2,
                1,
                survole ? teinte.argb() : MenuTheme.TEXT);
            return;
        }

        int fond = bouton.boutique()
            ? (survole ? VERT_FOND_SURVOL : VERT_FOND)
            : (survole ? BARRE_SURVOL : BARRE);
        int bord = bouton.boutique()
            ? VERT_BORD
            : (survole ? teinte.argb() : BARRE_BORD);
        int encre = bouton.boutique() ? VERT : MenuTheme.TEXT;

        MenuTheme.panel(context, bouton.x(), bouton.y(), bouton.w(), bouton.h(), fond);
        MenuTheme.outline(context, bouton.x(), bouton.y(), bouton.w(), bouton.h(), bord);

        // Icone et texte centres ensemble, et non le texte seul: c'est la
        // disposition du modele, ou le couple se lit comme un seul bloc.
        int cote = ModuleIcons.size(1);
        int bloc = cote + 4 + font.getWidth(bouton.label());
        int x = bouton.x() + (bouton.w() - bloc) / 2;

        ModuleIcons.draw(context, bouton.icone(), x, bouton.y() + (bouton.h() - cote) / 2, 1, encre);
        MenuTheme.text(context, font, bouton.label(), x + cote + 4,
            bouton.y() + (bouton.h() - font.fontHeight) / 2 + 1, encre);
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
            8, height - 10, MenuTheme.TEXT_DIM);
        MenuTheme.right(context, font, "Non affilie a Mojang",
            0, width - 8, height - 10, MenuTheme.TEXT_DIM);
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

        int gauche = (width - BARRE_L) / 2;
        // La premiere barre tombe 31 au-dessus du milieu de l'ecran sur le
        // modele (236 contre 266 en coordonnees d'interface). Trois rangees
        // suivent, au pas de BARRE_H + ECART.
        int y = height / 2 - 31;

        boutons.add(new Bouton(Action.SOLO, "Solo", "titre-solo",
            gauche, y, BARRE_L, BARRE_H, false));
        y += BARRE_H + ECART;
        boutons.add(new Bouton(Action.MULTI, "Multijoueur", "titre-multi",
            gauche, y, BARRE_L, BARRE_H, false));
        y += BARRE_H + ECART;

        boutons.add(new Bouton(Action.PARANOIA, "Paranoia", "titre-paranoia",
            gauche, y, DEMI_L, BARRE_H, false));
        boutons.add(new Bouton(Action.BOUTIQUE, "Boutique", "titre-boutique",
            gauche + DEMI_L + ECART, y, BARRE_L - DEMI_L - ECART, BARRE_H, true));

        // Les carres, colles au bas de l'ecran comme sur le modele: leur rangee
        // y commence a 17 du bord, et deux centres voisins sont distants de 23.
        Action[] carres = {
            Action.OPTIONS, Action.PARANOIA, Action.TEINTE, Action.PANORAMA, Action.QUITTER,
        };
        String[] icones = {
            "titre-options", "titre-paranoia", "titre-teinte", "titre-panorama", "titre-quitter",
        };

        int total = (carres.length - 1) * PAS_CARRE + CARRE;
        int x = (width - total) / 2;
        int bas = height - 17 - (CARRE - ModuleIcons.size(1)) / 2;
        for (int i = 0; i < carres.length; i++) {
            boutons.add(new Bouton(carres[i], null, icones[i], x, bas, CARRE, CARRE, false));
            x += PAS_CARRE;
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

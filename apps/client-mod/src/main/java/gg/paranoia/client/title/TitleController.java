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
import net.minecraft.util.Identifier;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

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

    /**
     * Le logo, pose sur un carre transparent de 512.
     *
     * <p>Le dessin lui-meme n'est pas carre -- il est une fois et demie plus
     * large que haut -- mais la texture l'est: une puissance de deux evite
     * toute surprise d'echantillonnage, et les marges transparentes ne coutent
     * rien. On dessine donc le carre, et le logo occupe la bande du milieu.
     */
    private static final Identifier LOGO =
        Identifier.of("paranoia_client", "textures/gui/title/logo.png");
    private static final int LOGO_TEXTURE = 512;
    /** Cote du carre a l'ecran; le dessin visible y fait 112 sur 75. */
    private static final int LOGO_COTE = 112;

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
    /** Ce qui a deja ete signale, pour ne pas le redire a chaque image. */
    private final Set<String> signale = new HashSet<>();

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
        logo(context);

        for (Bouton bouton : boutons) {
            dessine(context, bouton, teinte);
        }

        pastilleCompte(context, client, teinte);
        pied(context);
    }

    /**
     * Le panorama, puis un voile: sans lui le texte clair passe sur un ciel
     * clair.
     *
     * <p>Et un aplat quand le panorama n'est pas encore dessinable. Ce cas
     * n'est pas theorique: c'est par la que le jeu plantait au tout premier
     * lancement.
     */
    private void fond(DrawContext context, MinecraftClient client) {
        if (!panoramaDessine(context, client)) {
            context.fill(0, 0, width, height, MenuTheme.WINDOW);
            return;
        }
        context.fill(0, 0, width, height, MenuTheme.BACKDROP);
    }

    /**
     * Dessine le panorama, ou dit qu'il n'a pas pu l'etre.
     *
     * <p>Le jeu pose son ecran-titre <em>avant</em> la fin du premier
     * chargement des ressources, et le dessine derriere l'ecran de demarrage.
     * A cet instant les six faces du cubemap n'ont pas encore de texture GPU,
     * et le jeu levait « Texture view does not exist, can't get it before
     * something initializes it » -- un plantage au premier lancement, et
     * seulement au premier.
     *
     * <p>L'ecran-titre d'origine ne connait pas ce probleme: ses faces sont
     * enregistrees par {@code TitleScreen.registerTextures} au demarrage du
     * client, donc chargees depuis longtemps quand il les dessine. Les notres
     * arrivent avec le pack de ressources du mod, au meme rechargement que
     * celui qui est en cours.
     *
     * <p>On retente donc a chaque image plutot que d'abandonner: le
     * chargement dure une seconde, apres quoi le panorama s'affiche
     * normalement et plus rien ne passe par ici.
     */
    private boolean panoramaDessine(DrawContext context, MinecraftClient client) {
        try {
            RotatingCubeMapRenderer rendu = panorama(client);
            if (rendu == null) {
                return false;
            }
            rendu.render(context, width, height, true);
            return true;
        } catch (RuntimeException echec) {
            signale("panorama pas encore pret", echec);
            return false;
        }
    }

    private RotatingCubeMapRenderer panorama(MinecraftClient client) {
        Panorama choisi = panoramaChoisi();
        if (panorama != null && choisi == monte) {
            return panorama;
        }

        // Construit a cote, et seulement ensuite adopte: une construction qui
        // echoue a mi-chemin laisserait sinon un cube sans son enveloppe, et
        // l'image suivante le prendrait pour bon.
        CubeMapRenderer neuf = new CubeMapRenderer(choisi.cubeMap());
        neuf.registerTextures(client.getTextureManager());
        RotatingCubeMapRenderer tournant = new RotatingCubeMapRenderer(neuf);
        tournant.registerTextures(client.getTextureManager());

        if (cube != null) {
            cube.close();
        }
        cube = neuf;
        panorama = tournant;
        monte = choisi;
        return panorama;
    }

    private void logo(DrawContext context) {
        // Le modele centre son logo 76 au-dessus du milieu de l'ecran.
        int centre = height / 2 - 76;
        int haut = Math.max(4, centre - LOGO_COTE / 2);

        // Meme reserve que pour le panorama: la texture peut ne pas encore
        // exister a la premiere image. Le nom reste, lui, toujours lisible.
        try {
            Platforms.get().drawTexture(context, LOGO,
                (width - LOGO_COTE) / 2, haut, LOGO_COTE, LOGO_COTE,
                LOGO_TEXTURE, LOGO_TEXTURE);
        } catch (RuntimeException echec) {
            signale("logo pas encore pret", echec);
            MenuTheme.centered(context, font, "PARANOIA", 0, width,
                haut + LOGO_COTE / 2, MenuTheme.TEXT);
        }

        MenuAccueilModule reglages = MenuAccueilModule.instance();
        if (reglages == null || reglages.splash()) {
            String phrase = PHRASES[(int) (System.currentTimeMillis() / 86_400_000L % PHRASES.length)];
            // Sous le dessin visible, et non sous le carre: le quart bas de la
            // texture est transparent, et s'en servir comme repere laisserait
            // un trou de vingt pixels entre le logo et sa phrase.
            MenuTheme.centered(context, font, phrase, 0, width,
                haut + LOGO_COTE * 3 / 4 + 4, MenuTheme.TEXT_DIM);
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

    /**
     * Dit une fois ce qui n'a pas pu etre dessine.
     *
     * <p>Une fois, et non a chaque image: ces echecs durent le temps d'un
     * chargement de ressources, soit une soixantaine d'images, et les
     * imprimer toutes noierait le journal au moment ou on le lit.
     */
    private void signale(String quoi, RuntimeException echec) {
        if (!signale.add(quoi)) {
            return;
        }
        LoggerFactory.getLogger("ParanoiaClient")
            .info("[ACCUEIL] {}: {}", quoi, echec.getMessage());
    }

    private Teinte teinte() {
        MenuAccueilModule reglages = MenuAccueilModule.instance();
        return reglages == null ? Teinte.AMETHYSTE : reglages.teinte();
    }

    private Panorama panoramaChoisi() {
        MenuAccueilModule reglages = MenuAccueilModule.instance();
        return reglages == null ? Panorama.SPAWN : reglages.panorama();
    }
}

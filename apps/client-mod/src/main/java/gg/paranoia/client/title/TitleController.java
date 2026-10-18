package gg.paranoia.client.title;

import gg.paranoia.client.ParanoiaClient;
import gg.paranoia.client.menu.MenuTheme;
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
import net.minecraft.text.Style;
import net.minecraft.text.Text;
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
        /** Allume ou coupe l'habillage d'Halloween. N'existe que pendant la periode. */
        HALLOWEEN,
    }

    /** Ce qu'une entree dessine: une ligne du menu, ou un raccourci du bas. */
    private enum Genre {
        MENU,
        RACCOURCI,
    }

    /**
     * Une entree posee: sa place, ce qu'elle montre, et ce qu'elle fait.
     *
     * <p>Une ligne du menu porte un texte en grosses lettres, a l'echelle
     * {@code echelle}. Un raccourci porte un texte a taille normale suivi de
     * son icone dans une case, a la facon d'une touche de manette.
     */
    private record Bouton(
        Action action, Genre genre, String label, Identifier icone,
        int x, int y, int w, int h, int echelle) {
    }

    /*
     * La disposition, inspiree des menus de jeux de console: le menu est une
     * colonne de mots, alignee a gauche et tenue par un trait vertical, et
     * non une pile de boutons centres. Le panorama occupe tout le reste de
     * l'ecran au lieu d'etre masque par un bloc au milieu.
     *
     * Les tailles sont des multiples entiers de la police: elle est une image,
     * et un facteur fractionnaire en brouillerait les pixels.
     */

    /** Marge gauche du texte du menu. Le trait vertical se tient a 12 devant. */
    private static final int MARGE = 34;
    private static final int TRAIT_X = MARGE - 12;
    /** Hauteur d'une lettre de la police, avant agrandissement. */
    private static final int LETTRE = 8;
    /** L'entree principale est plus grosse que les autres: c'est elle qu'on cherche. */
    private static final int ECHELLE_PRINCIPALE = 3;
    private static final int ECHELLE = 2;
    /** Ecart vertical entre deux lignes du menu. */
    private static final int INTERLIGNE = 7;
    /** Distance entre le bas du menu et le bas de l'ecran: les raccourcis vivent dessous. */
    private static final int BAS_MENU = 56;
    /** Cote de la case d'un raccourci, et pas entre deux raccourcis. */
    private static final int CASE = 18;
    private static final int PAS_RACCOURCI = 12;

    /** Le texte du menu au repos, legerement en retrait du blanc pur. */
    private static final int MENU_TEXTE = 0xFFE9E9ED;
    private static final int TRAIT = 0x66E9E9ED;
    /** La boutique garde sa couleur propre: c'est ce qui la distingue. */
    private static final int VERT = 0xFF5BD98A;
    private static final int CASE_FOND = 0xCC13151B;
    private static final int CASE_BORD = 0x55E9E9ED;

    /** La police a pixels du mod, pour les mots du menu. */
    private static final Identifier POLICE = Identifier.of("paranoia_client", "silkscreen");

    /**
     * Le logo, a sa taille de texture divisee par deux: deux texels par point,
     * donc net au plus proche voisin a l'echelle d'interface 2.
     */
    private static final Identifier LOGO =
        Identifier.of("paranoia_client", "textures/gui/title/logo.png");
    private static final int LOGO_TEXTURE_L = 176;
    private static final int LOGO_TEXTURE_H = 122;
    private static final int LOGO_L = LOGO_TEXTURE_L / 2;
    private static final int LOGO_H = LOGO_TEXTURE_H / 2;

    /** Les icones, un fichier par dessin, au double de leur taille a l'ecran. */
    private static final int ICONE_TEXTURE = 32;
    private static final int ICONE = ICONE_TEXTURE / 2;
    private static final int BLANC = 0xFFFFFFFF;

    private static Identifier icone(String nom) {
        return Identifier.of("paranoia_client", "textures/gui/title/icone/" + nom + ".png");
    }


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
        rendLeCube();
    }

    // ------------------------------------------------------------------ rendu

    public void render(DrawContext context, int mouseX, int mouseY) {
        this.mouseX = mouseX;
        this.mouseY = mouseY;

        MinecraftClient client = MinecraftClient.getInstance();
        boolean halloween = Halloween.actif();
        // Pendant Halloween l'accent est la citrouille, quelle que soit la
        // teinte choisie. Le choix du joueur n'est pas touche, il revient tel
        // quel le 3 novembre.
        int accent = halloween ? Halloween.CITROUILLE : teinte().argb();
        long ms = System.nanoTime() / 1_000_000L;

        fond(context, client, halloween);
        ombreGauche(context, halloween);
        dispose();
        if (halloween) {
            Halloween.arrierePlan(context, width, height, ms);
        }

        logo(context, halloween);
        trait(context, halloween);
        for (Bouton bouton : boutons) {
            dessine(context, bouton, accent, halloween);
        }

        int basCarte = carteCompte(context, client, accent, halloween);
        if (halloween) {
            Halloween.compte(context, font, width - 8, basCarte + 6);
            Halloween.premierPlan(context, width, height, ms);
        }
        pied(context, halloween);
    }

    /**
     * Le panorama, puis un voile: sans lui le texte clair passe sur un ciel
     * clair.
     *
     * <p>Et un aplat quand le panorama n'est pas encore dessinable. Ce cas
     * n'est pas theorique: c'est par la que le jeu plantait au tout premier
     * lancement.
     */
    private void fond(DrawContext context, MinecraftClient client, boolean halloween) {
        if (!panoramaDessine(context, client)) {
            context.fill(0, 0, width, height, halloween ? Halloween.VOILE_PLEIN : MenuTheme.WINDOW);
            return;
        }
        context.fill(0, 0, width, height, halloween ? Halloween.VOILE : MenuTheme.BACKDROP);
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

    /**
     * Rend le tampon GPU du cubemap en cours, s'il y en a un.
     *
     * <p>Appele quand on change de panorama et a la fermeture de l'ecran. Un
     * {@code CubeMapRenderer} tient un tampon GPU: en abandonner un par image
     * les accumulerait.
     */
    private void rendLeCube() {
        if (cube != null) {
            cube.close();
            cube = null;
            panorama = null;
            monte = null;
        }
    }

    private RotatingCubeMapRenderer panorama(MinecraftClient client) {
        Panorama choisi = panoramaChoisi();
        if (panorama != null && choisi == monte) {
            return panorama;
        }

        // Les six faces sont demandees au gestionnaire de textures avant
        // d'etre dessinees, et c'est la correction du panorama qui ne
        // s'affichait pas.
        //
        // `registerTextures` inscrit les faces, mais une texture inscrite
        // apres le rechargement des ressources n'est jamais chargee: son
        // enveloppe GPU reste vide, et `draw` echoue sur « Texture view does
        // not exist ». L'ecran-titre d'origine n'a pas ce souci -- le jeu
        // inscrit ses faces au demarrage du client, donc avant le premier
        // rechargement.
        //
        // Le logo, lui, s'affichait: `drawTexture` passe par `getTexture`,
        // qui charge a la demande. C'est ce chemin-la qu'on emprunte ici, pour
        // les six faces, avant de laisser le cubemap les lire.
        for (int face = 0; face < 6; face++) {
            client.getTextureManager().getTexture(Identifier.of(
                choisi.cubeMap().getNamespace(),
                choisi.cubeMap().getPath() + "_" + face + ".png"));
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

    /**
     * Assombrit le tiers gauche, la ou se tient le menu.
     *
     * <p>Le voile general ne suffit plus: le texte n'a plus de fond de bouton
     * derriere lui, et un panorama clair le rendrait illisible. L'ombre
     * s'efface vers la droite en paliers, pour laisser le paysage intact
     * ailleurs. En paliers et non en degrade, pour la meme raison que la
     * brume d'Halloween: {@code fillGradient} n'est pas dans la liste des API
     * verifiees.
     */
    private void ombreGauche(DrawContext context, boolean halloween) {
        int base = halloween ? 0x0B060A : 0x0B0C14;
        int largeur = Math.max(160, width * 2 / 5);
        int paliers = 24;
        for (int i = 0; i < paliers; i++) {
            int alpha = 0x90 * (paliers - i) / paliers;
            int x1 = largeur * i / paliers;
            int x2 = largeur * (i + 1) / paliers;
            context.fill(x1, 0, x2, height, (alpha << 24) | base);
        }
    }

    /** Le haut du menu, recalcule a chaque image par {@link #dispose}. */
    private int hautMenu;
    private int basMenu;

    /**
     * Le logo, au-dessus du menu et aligne sur lui. Il s'efface quand la
     * fenetre est trop basse pour lui laisser la place: le menu passe avant.
     */
    private void logo(DrawContext context, boolean halloween) {
        int haut = hautMenu - LOGO_H - 14;
        if (haut < 30) {
            return;
        }
        try {
            // Le logo d'Halloween est un fichier a part et non le meme teinte:
            // une teinte multiplie, et le violet du C serait devenu brun.
            Platforms.get().drawTexture(context, halloween ? Halloween.LOGO : LOGO,
                MARGE - 4, haut, LOGO_L, LOGO_H,
                LOGO_TEXTURE_L, LOGO_TEXTURE_H, BLANC);
        } catch (RuntimeException echec) {
            signale("logo pas encore pret", echec);
        }
    }

    /**
     * Le trait vertical qui tient le menu, termine en bas par un petit carre
     * creux: il dit ou la colonne s'arrete, et relie le menu aux raccourcis.
     */
    private void trait(DrawContext context, boolean halloween) {
        int couleur = halloween ? 0x80FC8731 : TRAIT;
        int haut = hautMenu - 6;
        int bas = basMenu + 12;
        context.fill(TRAIT_X, haut, TRAIT_X + 1, bas, couleur);
        MenuTheme.outline(context, TRAIT_X - 2, bas, 5, 5, couleur);
        context.fill(TRAIT_X + 3, bas + 2, TRAIT_X + 12, bas + 3, couleur);
    }

    /** Le texte dans la police du menu, ou celle du jeu si la version ne sait pas en designer. */
    private Text mot(String texte) {
        Style style = Platforms.get().fontStyle(POLICE);
        return style == Style.EMPTY ? Text.literal(texte) : Text.literal(texte).setStyle(style);
    }

    private void dessine(DrawContext context, Bouton bouton, int accent, boolean halloween) {
        boolean survole = MenuTheme.inside(
            mouseX, mouseY, bouton.x(), bouton.y(), bouton.w(), bouton.h());

        if (bouton.genre() == Genre.MENU) {
            dessineMot(context, bouton, survole, accent, halloween);
        } else {
            dessineRaccourci(context, bouton, survole, accent, halloween);
        }
    }

    /**
     * Une ligne du menu.
     *
     * <p>Au survol elle prend l'accent, glisse de quatre points vers la droite
     * et gagne un repere sur le trait: trois signaux pour un seul etat, parce
     * qu'un mot sans cadre n'a pas de fond qui puisse s'eclairer.
     */
    private void dessineMot(DrawContext context, Bouton bouton, boolean survole,
                            int accent, boolean halloween) {
        int repos = bouton.action() == Action.BOUTIQUE
            ? VERT
            : (halloween ? Halloween.ENCRE : MENU_TEXTE);
        int couleur = survole ? (bouton.action() == Action.BOUTIQUE ? VERT : accent) : repos;
        int x = MARGE + (survole ? 4 : 0);

        if (survole) {
            int milieu = bouton.y() + bouton.h() / 2;
            context.fill(TRAIT_X - 1, milieu - 3, TRAIT_X + 2, milieu + 3, couleur);
        }

        int echelle = bouton.echelle();
        Platforms.get().pushScale(context, echelle, x, bouton.y());
        context.drawText(font, mot(bouton.label()), 0, 0, couleur, true);
        Platforms.get().popScale(context);
    }

    /** Un raccourci: son nom, puis son icone dans une case, comme une touche. */
    private void dessineRaccourci(DrawContext context, Bouton bouton, boolean survole,
                                  int accent, boolean halloween) {
        int encre = halloween ? Halloween.ENCRE : MenuTheme.TEXT;
        int texte = survole ? accent : encre;
        int largeurTexte = font.getWidth(bouton.label());

        context.drawText(font, bouton.label(), bouton.x(),
            bouton.y() + (CASE - font.fontHeight) / 2 + 1, texte, true);

        int cx = bouton.x() + largeurTexte + 5;
        MenuTheme.panel(context, cx, bouton.y(), CASE, CASE,
            halloween ? Halloween.BARRE : CASE_FOND);
        MenuTheme.outline(context, cx, bouton.y(), CASE, CASE,
            survole ? accent : (halloween ? Halloween.BARRE_BORD : CASE_BORD));

        int teinte;
        if (bouton.action() == Action.HALLOWEEN) {
            // Citrouille orange quand l'habillage est allume, grise sinon:
            // l'icone dit l'etat, comme un interrupteur.
            teinte = halloween ? accent : MenuTheme.TEXT_DIM;
        } else {
            teinte = survole ? accent : encre;
        }
        dessineTexture(context, bouton.icone(), cx + 1, bouton.y() + 1, teinte);
    }

    /**
     * Une icone, teintee.
     *
     * <p>Les fichiers sont blancs: c'est la teinte qui donne la couleur, ce
     * qui evite un fichier par etat et garde le survol d'accord avec le reste
     * de l'ecran.
     */
    private void dessineTexture(DrawContext context, Identifier texture, int x, int y, int couleur) {
        try {
            Platforms.get().drawTexture(context, texture, x, y, ICONE, ICONE,
                ICONE_TEXTURE, ICONE_TEXTURE, couleur);
        } catch (RuntimeException echec) {
            signale("icones pas encore pretes", echec);
        }
    }

    /**
     * Le joueur connecte, en haut a droite, dans un cartouche borde de
     * l'accent. Rend le bas du cartouche, pour poser ce qui vient dessous.
     */
    private int carteCompte(DrawContext context, MinecraftClient client, int accent, boolean halloween) {
        String pseudo = MenuTheme.fit(font, client.getSession().getUsername(), 140);
        int largeur = font.getWidth(pseudo) + 22;
        int hauteur = 18;
        int x = width - 8 - largeur;
        int y = 8;

        MenuTheme.panel(context, x, y, largeur, hauteur, halloween ? Halloween.BARRE : CASE_FOND);
        MenuTheme.outline(context, x, y, largeur, hauteur, accent);
        // Un losange de l'accent, ligne par ligne: 1, 3, 5, 3, 1 points.
        int lx = x + 8;
        int ly = y + hauteur / 2 - 2;
        for (int i = 0; i < 5; i++) {
            int demi = 2 - Math.abs(2 - i);
            context.fill(lx - demi, ly + i, lx + demi + 1, ly + i + 1, accent);
        }
        context.drawText(font, pseudo, x + 15, y + (hauteur - font.fontHeight) / 2 + 1,
            halloween ? Halloween.ENCRE : MenuTheme.TEXT, false);
        return y + hauteur;
    }

    private void pied(DrawContext context, boolean halloween) {
        int gris = halloween ? 0xFFA2939C : MenuTheme.TEXT_DIM;
        MenuTheme.right(context, font,
            "Paranoia Client - Minecraft " + Platforms.get().minecraftVersion()
                + " - Non affilie a Mojang",
            0, width - 8, height - 10, gris);
    }

    // --------------------------------------------------------------- position

    /**
     * Repose les entrees pour la taille courante.
     *
     * <p>A chaque image, et non une fois: la fenetre se redimensionne, et une
     * disposition calculee une seule fois laisserait les zones cliquables la ou
     * les mots ne sont plus.
     */
    private void dispose() {
        boutons.clear();

        Object[][] menu = {
            {Action.SOLO, "Jouer", ECHELLE_PRINCIPALE},
            {Action.MULTI, "Multijoueur", ECHELLE},
            {Action.PARANOIA, "Paranoia", ECHELLE},
            {Action.BOUTIQUE, "Boutique", ECHELLE},
            {Action.QUITTER, "Quitter", ECHELLE},
        };

        int total = 0;
        for (Object[] ligne : menu) {
            total += LETTRE * (int) ligne[2] + INTERLIGNE;
        }
        total -= INTERLIGNE;

        // Ancre en bas et non centre: les raccourcis tiennent sous le menu, et
        // c'est le logo qui cede quand la fenetre est basse, jamais le menu.
        int y = Math.max(8, height - BAS_MENU - total);
        hautMenu = y;
        for (Object[] ligne : menu) {
            Action action = (Action) ligne[0];
            String texte = ((String) ligne[1]).toUpperCase(java.util.Locale.ROOT);
            int echelle = (int) ligne[2];
            int h = LETTRE * echelle;
            // La zone cliquable deborde de quelques points autour du mot: on
            // vise un mot plus mal qu'un bouton.
            int w = font.getWidth(mot(texte)) * echelle + 10;
            boutons.add(new Bouton(action, Genre.MENU, texte, null,
                MARGE - 4, y - 2, w + 4, h + 4, echelle));
            y += h + INTERLIGNE;
        }
        basMenu = y - INTERLIGNE;

        // Les raccourcis, sous le trait. La citrouille ne s'ajoute que pendant
        // la periode: hors d'elle, il n'y a rien a allumer.
        int x = MARGE;
        int yr = height - 30;
        x = raccourci(Action.OPTIONS, "Options", icone("titre-options"), x, yr);
        x = raccourci(Action.TEINTE, "Teinte", icone("titre-teinte"), x, yr);
        x = raccourci(Action.PANORAMA, "Panorama", icone("titre-panorama"), x, yr);
        if (Halloween.enPeriode()) {
            raccourci(Action.HALLOWEEN, "Halloween", Halloween.ICONE, x, yr);
        }
    }

    /** Pose un raccourci et rend l'abscisse du suivant. */
    private int raccourci(Action action, String label, Identifier icone, int x, int y) {
        int w = font.getWidth(label) + 5 + CASE;
        boutons.add(new Bouton(action, Genre.RACCOURCI, label, icone, x, y, w, CASE, 1));
        return x + w + PAS_RACCOURCI;
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
            case HALLOWEEN -> {
                MenuAccueilModule reglages = MenuAccueilModule.instance();
                if (reglages != null) {
                    reglages.basculeHalloween();
                }
            }
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

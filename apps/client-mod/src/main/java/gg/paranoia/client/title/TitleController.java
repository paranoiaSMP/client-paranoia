package gg.paranoia.client.title;

import gg.paranoia.client.ParanoiaClient;
import gg.paranoia.client.menu.MenuTheme;
import gg.paranoia.client.modules.MenuAccueilModule;
import gg.paranoia.client.platform.Platforms;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
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
 * <p>Le fond ne passe pas par le cubemap du jeu, et c'est une decision prise
 * apres trois echecs: sa texture est d'un type particulier, chargee a un
 * moment precis du demarrage, et l'inscrire depuis un mod l'empeche d'etre
 * chargee -- quand elle n'ecrase pas celle du jeu, ce qui faisait planter
 * tous les ecrans qui s'en servent. Les faces, elles, sont de simples images.
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
        System.getProperty("paranoia.boutique", "https://paranoiastudio.fr/shop").trim();

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

    /*
     * Le logo fait exactement le double de sa taille a l'ecran.
     *
     * <p>Minecraft echantillonne les textures d'interface au plus proche
     * voisin. Le fichier faisait 512 de cote et tombait dans une boite de 112:
     * un texel sur cinq etait garde, et chaque bord du trace devenait un
     * escalier. A l'echelle d'interface 2 -- la plus courante -- deux texels
     * valent desormais deux pixels, et le dessin reste net.
     *
     * <p>Il n'est plus carre non plus: ses marges transparentes servaient a
     * faire une puissance de deux dont le rendu n'a pas besoin, et elles
     * compliquaient le placement pour rien.
     */
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

    /** Ce qui a deja ete signale, pour ne pas le redire a chaque image. */
    private final Set<String> signale = new HashSet<>();

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
     * Appele quand l'ecran disparait.
     *
     * <p>Plus rien a liberer depuis que le fond est fait d'images: elles
     * appartiennent au gestionnaire de textures, qui les partage avec tout le
     * reste du jeu. La methode reste parce que l'ecran de version l'appelle,
     * et qu'elle redeviendra utile le jour ou il y aura quelque chose a y
     * mettre.
     */
    public void onClosed() {
    }

    // ------------------------------------------------------------------ rendu

    public void render(DrawContext context, int mouseX, int mouseY) {
        this.mouseX = mouseX;
        this.mouseY = mouseY;

        MinecraftClient client = MinecraftClient.getInstance();
        Teinte teinte = teinte();

        fond(context);
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
    private void fond(DrawContext context) {
        if (bandeQuiDefile(context)) {
            context.fill(0, 0, width, height, MenuTheme.BACKDROP);
            return;
        }
        context.fill(0, 0, width, height, MenuTheme.WINDOW);
    }

    /**
     * Les quatre horizons, qui defilent, quand le cubemap ne veut pas.
     *
     * <p>Le cubemap est un chemin de rendu a lui tout seul: une texture d'un
     * type particulier, chargee a un moment precis, lue par du code qu'on ne
     * controle pas. Il a refuse trois fois. Une face prise seule n'est qu'une
     * image, et c'est le chemin du logo -- celui dont on sait qu'il marche.
     *
     * <p>Les quatre horizons sont donc poses cote a cote en une bande, et la
     * bande defile. Ce n'est pas la rotation du jeu -- il n'y a pas de
     * perspective, les faces glissent au lieu de pivoter -- mais le spawn
     * tourne, sans dependre de rien d'incertain.
     *
     * <p>Chaque face est dessinee a la hauteur de l'ecran. Elles sont carrees:
     * la bande fait donc quatre hauteurs de large, et un tour complet dure une
     * minute, comme celui du jeu.
     */
    private boolean bandeQuiDefile(DrawContext context) {
        Panorama choisi = panoramaChoisi();
        int cote = height;
        int bande = cote * 4;
        // Le temps absolu, et non un compteur d'images: le defilement garde la
        // meme vitesse quel que soit le nombre d'images par seconde.
        int decalage = (int) (System.currentTimeMillis() % 60_000L * bande / 60_000L);

        try {
            for (int horizon = 0; horizon < 4; horizon++) {
                int x = horizon * cote - decalage;
                // Deux fois: une face qui sort par la gauche doit reparaitre
                // par la droite sans trou au raccord.
                poseFace(context, choisi, horizon, x, cote);
                poseFace(context, choisi, horizon, x + bande, cote);
            }
            return true;
        } catch (RuntimeException echec) {
            signale("horizons pas encore prets", echec);
            return false;
        }
    }

    /** Une face, si elle tombe dans l'ecran. */
    private void poseFace(DrawContext context, Panorama choisi, int horizon, int x, int cote) {
        if (x + cote <= 0 || x >= width) {
            return;
        }
        Platforms.get().drawTexture(context, choisi.face(horizon),
            x, 0, cote, cote, choisi.tailleFace(), choisi.tailleFace(), BLANC);
    }

    private void logo(DrawContext context) {
        // Le modele centre son logo 76 au-dessus du milieu de l'ecran.
        int haut = Math.max(4, height / 2 - 76 - LOGO_H / 2);

        // Meme reserve que pour le panorama: la texture peut ne pas encore
        // exister a la premiere image. Le nom reste, lui, toujours lisible.
        try {
            Platforms.get().drawTexture(context, LOGO,
                (width - LOGO_L) / 2, haut, LOGO_L, LOGO_H,
                LOGO_TEXTURE_L, LOGO_TEXTURE_H, BLANC);
        } catch (RuntimeException echec) {
            signale("logo pas encore pret", echec);
            MenuTheme.centered(context, font, "PARANOIA", 0, width,
                haut + LOGO_H / 2, MenuTheme.TEXT);
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
            dessineIcone(context, bouton.icone(),
                bouton.x() + (bouton.w() - ICONE) / 2,
                bouton.y() + (bouton.h() - ICONE) / 2,
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
        int bloc = ICONE + 4 + font.getWidth(bouton.label());
        int x = bouton.x() + (bouton.w() - bloc) / 2;

        dessineIcone(context, bouton.icone(), x, bouton.y() + (bouton.h() - ICONE) / 2, encre);
        MenuTheme.text(context, font, bouton.label(), x + ICONE + 4,
            bouton.y() + (bouton.h() - font.fontHeight) / 2 + 1, encre);
    }

    /**
     * Une icone, teintee.
     *
     * <p>Les fichiers sont blancs: c'est la teinte qui donne la couleur, ce
     * qui evite un fichier par etat et garde le survol d'accord avec le reste
     * de l'ecran.
     */
    private void dessineIcone(DrawContext context, String nom, int x, int y, int couleur) {
        try {
            Platforms.get().drawTexture(context, icone(nom), x, y, ICONE, ICONE,
                ICONE_TEXTURE, ICONE_TEXTURE, couleur);
        } catch (RuntimeException echec) {
            signale("icones pas encore pretes", echec);
        }
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

        boutons.add(new Bouton(Action.SOLO, "Solo", "solo",
            gauche, y, BARRE_L, BARRE_H, false));
        y += BARRE_H + ECART;
        boutons.add(new Bouton(Action.MULTI, "Multijoueur", "multi",
            gauche, y, BARRE_L, BARRE_H, false));
        y += BARRE_H + ECART;

        boutons.add(new Bouton(Action.PARANOIA, "Paranoia", "paranoia",
            gauche, y, DEMI_L, BARRE_H, false));
        boutons.add(new Bouton(Action.BOUTIQUE, "Boutique", "boutique",
            gauche + DEMI_L + ECART, y, BARRE_L - DEMI_L - ECART, BARRE_H, true));

        // Les carres, colles au bas de l'ecran comme sur le modele: leur rangee
        // y commence a 17 du bord, et deux centres voisins sont distants de 23.
        Action[] carres = {
            Action.OPTIONS, Action.PARANOIA, Action.TEINTE, Action.PANORAMA, Action.QUITTER,
        };
        String[] icones = {
            "options", "paranoia", "teinte", "panorama", "quitter",
        };

        int total = (carres.length - 1) * PAS_CARRE + CARRE;
        int x = (width - total) / 2;
        int bas = height - 17 - (CARRE - ICONE) / 2;
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

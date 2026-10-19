package gg.paranoia.client.title;

import gg.paranoia.client.ParanoiaClient;
import gg.paranoia.client.menu.MenuTheme;
import gg.paranoia.client.modules.MenuAccueilModule;
import gg.paranoia.client.net.PresenceService;
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

import java.time.LocalDate;
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
        HALLOWEEN,
        QUITTER,
    }

    /** Un titre de la colonne de gauche, ou un outil de la barre du bas. */
    private enum Genre {
        TITRE,
        OUTIL,
    }

    /**
     * Un bouton pose: sa place, ce qu'il montre, et ce qu'il fait.
     *
     * <p>Les deux genres partagent le meme enregistrement et la meme liste
     * parce qu'ils partagent surtout le meme clic: une seule boucle les teste,
     * et il n'y a donc pas deux endroits d'ou une zone cliquable pourrait
     * deriver de son dessin.
     */
    private record Bouton(
        Action action, Genre genre, String label, String icone,
        float echelle, int x, int y, int w, int h, boolean boutique) {
    }

    /*
     * Les mesures, relevees sur la maquette plutot qu'approchees a l'oeil. Elle
     * fait 1920 de large pour une interface a l'echelle 2: tout ce qui suit est
     * donc la moitie de ce qu'on y mesure.
     *
     * <p>La colonne est ancree au bas de l'ecran et non a son milieu. C'est la
     * que la maquette la pose, et c'est surtout ce qui garde constante la
     * distance entre le dernier titre et la barre d'outils: ancres l'un au
     * milieu et l'autre au bas, les deux se seraient croises sur une fenetre
     * basse.
     */

    /** Le rail vertical qui longe la colonne, et le bord gauche des titres. */
    private static final int RAIL_X = 24;
    private static final int TITRE_X = 36;

    /*
     * Hauteur du premier titre au-dessus du bas de l'ecran: le plancher releve
     * sur la maquette, et au-dela une part de la hauteur.
     *
     * <p>Les deux, parce qu'aucun des deux ne suffit. Un nombre fixe de pixels
     * n'est juste qu'a une seule taille de fenetre: sur un ecran haut, ou a une
     * autre echelle d'interface, la colonne se colle au bas et tout le reste
     * paraait vide. Une part seule laisserait la colonne descendre sur la barre
     * d'outils des que la fenetre devient basse, parce que la hauteur du texte,
     * elle, ne suit pas -- elle tient a l'echelle de la police.
     *
     * <p>0,307 est ce que la maquette donne: le premier titre y commence a
     * 373 sur 538, soit 165 du bas. Les deux valeurs se rejoignent donc a la
     * taille de reference, et le plancher ne prend la main que plus bas.
     */
    private static final int COLONNE_FOND = 165;
    private static final float COLONNE_PART = 0.307f;

    /** Blanc entre deux titres, en plus de la hauteur du texte. */
    private static final int TITRE_ECART = 10;
    /** Ce qui separe le bas du logo du haut du premier titre. */
    private static final int LOGO_ECART = 21;

    /*
     * Jouer est plus gros que les autres, au repos comme au survol: c'est la
     * seule action que l'ecran recommande, et l'echelle le dit mieux qu'une
     * couleur -- qui est deja prise par le survol.
     */
    private static final float ECHELLE_JOUER = 2.0f;
    private static final float ECHELLE_TITRE = 1.5f;
    /** Ce que le survol ajoute: assez pour se voir, pas assez pour bousculer. */
    private static final float ECHELLE_SURVOL = 1.18f;

    /** La barre d'outils du bas: un libelle, puis son icone. */
    private static final int OUTIL_H = 16;
    private static final int OUTIL_ICONE = 12;
    private static final int OUTIL_ECART = 14;
    /** Hauteur de la barre d'outils au-dessus du bas de l'ecran. */
    private static final int OUTIL_FOND = 26;

    /** Corps de la mention legale du pied, par rapport a la police du jeu. */
    private static final float PIED_ECHELLE = 0.7f;

    /*
     * Les couleurs, relevees elles aussi. Le fond d'une barre rend (19, 21, 27)
     * au-dessus d'un panorama clair comme au-dessus d'un panorama sombre: il
     * est donc opaque, et non un noir translucide comme on pourrait le croire.
     */
    /** La boutique garde sa couleur propre: c'est ce qui la distingue. */
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

    /**
     * Le meme logo, le « C » passe a l'orange.
     *
     * <p>Un second fichier et non une teinte: la teinte s'applique au dessin
     * entier, et elle aurait colore le « P » blanc avec. Celui-ci est derive du
     * premier en ne remplacant que les pixels violets, clarte conservee -- les
     * bords adoucis du « C » le restent au lieu de devenir un aplat dentele.
     */
    private static final Identifier LOGO_SAISON =
        Identifier.of("paranoia_client", "textures/gui/title/logo-halloween.png");

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
    private static final int LOGO_TEXTURE_H = 100;

    /*
     * Releve sur la maquette: le logo y fait 61 de haut en coordonnees
     * d'interface, pas 50. La moitie exacte de la texture donnait un dessin net
     * -- deux texels pour deux pixels -- mais un bloc plus court que le modele
     * de dix pixels, pris entierement sur le haut.
     *
     * On suit la maquette et on perd l'echantillonnage exact. C'est un logo
     * fait de larges aplats et d'arcs: il supporte le leger agrandissement, la
     * ou la toile ou une chauve-souris ne le supporteraient pas -- elles sont
     * dessinees pixel par pixel, et c'est pour elles que la regle du multiple
     * entier existe.
     */
    private static final int LOGO_H = 60;
    private static final int LOGO_L = LOGO_TEXTURE_L * LOGO_H / LOGO_TEXTURE_H;

    /** Les icones, un fichier par dessin, au double de leur taille a l'ecran. */
    private static final int ICONE_TEXTURE = 32;
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

    /** Place de la pastille de compte, relevee au dessin pour le clic. */
    private int largeurPastille;
    private int gauchePastille;

    /**
     * La liste des comptes du launcher, depliee sous la pastille.
     *
     * <p>Fermee par defaut: l'ecran d'accueil n'est pas un gestionnaire de
     * comptes, c'est un bouton Jouer. Elle s'ouvre quand on le demande.
     */
    private boolean comptesDeplies;

    /** Ce qui a deja ete signale, pour ne pas le redire a chaque image. */
    private final Set<String> signale = new HashSet<>();

    /** L'ecran hote, pour les ecrans du jeu qui veulent savoir d'ou l'on vient. */
    public void attache(Screen ecran) {
        this.ecran = ecran;
        comptesDeplies = false;
        // A l'ouverture de l'ecran, et pas a chaque image: le launcher est un
        // processus voisin, pas une source a interroger soixante fois par
        // seconde.
        Comptes.rafraichit();
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
        Saison saison = saison();
        int accent = accent(saison);

        fond(context);

        // Le decor de saison encadre l'interface: le ciel derriere elle, le sol
        // devant. Une chauve-souris qui passerait par-dessus les titres les
        // rendrait illisibles une seconde sur trois, pour rien.
        if (saison == Saison.HALLOWEEN) {
            Decor.arriere(context, width, height);
        }

        dispose(saison);
        logo(context, saison);
        rail(context, saison);

        for (Bouton bouton : boutons) {
            dessine(context, bouton, accent);
        }

        if (saison == Saison.HALLOWEEN) {
            Decor.avant(context, width, height);
        }

        pastilleCompte(context, client, accent, saison);
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

    /**
     * Le haut du premier titre.
     *
     * <p>Une seule source pour la colonne et pour le logo qui la coiffe: ils se
     * suivent, et deux calculs paralleles finiraient par se decoller l'un de
     * l'autre a la premiere retouche.
     */
    private int hautColonne() {
        return height - Math.max(COLONNE_FOND, (int) (height * COLONNE_PART));
    }

    /** Le haut du logo, pose au-dessus de la colonne et aligne sur elle. */
    private int hautLogo() {
        return Math.max(4, hautColonne() - LOGO_ECART - LOGO_H);
    }

    private void logo(DrawContext context, Saison saison) {
        int haut = hautLogo();

        // Meme reserve que pour le panorama: la texture peut ne pas encore
        // exister a la premiere image. Le nom reste, lui, toujours lisible.
        try {
            Platforms.get().drawTexture(
                context, saison == Saison.HALLOWEEN ? LOGO_SAISON : LOGO,
                TITRE_X - 4, haut, LOGO_L, LOGO_H,
                LOGO_TEXTURE_L, LOGO_TEXTURE_H, BLANC);
        } catch (RuntimeException echec) {
            signale("logo pas encore pret", echec);
            MenuTheme.text(context, font, "PARANOIA",
                TITRE_X, haut + LOGO_H / 2, MenuTheme.TEXT);
        }
    }

    private void dessine(DrawContext context, Bouton bouton, int accent) {
        boolean survole = MenuTheme.inside(
            mouseX, mouseY, bouton.x(), bouton.y(), bouton.w(), bouton.h());

        if (bouton.genre() == Genre.TITRE) {
            dessineTitre(context, bouton, accent, survole);
        } else {
            dessineOutil(context, bouton, accent, survole);
        }
    }

    /**
     * Un titre de la colonne, grossi et colore au survol.
     *
     * <p>Il grossit autour du milieu de sa ligne et non de son coin haut
     * gauche: ancre en haut, il descendrait sur le titre suivant a chaque
     * survol, et la colonne entiere paraitrait bouger pour un seul mot.
     *
     * <p>La zone cliquable, elle, garde la taille du repos. Si elle suivait la
     * taille dessinee, le titre deborderait sous le curseur et le survol se
     * mettrait a battre sur son bord -- il grandit, donc il reste survole, donc
     * il grandit.
     */
    private void dessineTitre(DrawContext context, Bouton bouton, int accent, boolean survole) {
        int centreY = bouton.y() + bouton.h() / 2;

        // La boutique garde son vert jusque dans le survol: c'est ce qui la
        // distingue des autres, et l'accent le lui prendrait.
        int encre = bouton.boutique() ? VERT : (survole ? accent : MenuTheme.TEXT);

        if (survole) {
            // Le repere du rail. Sans lui le trait ne sert a rien; avec lui, il
            // dit lequel des titres repond.
            context.fill(RAIL_X - 1, centreY - 4, RAIL_X + 2, centreY + 4, accent);
        }

        float echelle = survole ? bouton.echelle() * ECHELLE_SURVOL : bouton.echelle();
        Platforms.get().pushScale(context, echelle, bouton.x(), centreY);
        try {
            // Les coordonnees sont desormais relatives au pivot et a l'echelle:
            // zero est le bord gauche du titre, et la demi-hauteur du texte
            // remontee le recentre sur sa ligne.
            MenuTheme.text(context, font, bouton.label(), 0, -font.fontHeight / 2, encre);
        } finally {
            Platforms.get().popScale(context);
        }
    }

    /** Un outil de la barre du bas: son libelle, puis son icone. */
    private void dessineOutil(DrawContext context, Bouton bouton, int accent, boolean survole) {
        int encre = survole ? accent : MenuTheme.TEXT_DIM;

        MenuTheme.text(context, font, bouton.label(),
            bouton.x(), bouton.y() + (OUTIL_H - font.fontHeight) / 2, encre);
        dessineIcone(context, bouton.icone(),
            bouton.x() + font.getWidth(bouton.label()) + 4,
            bouton.y() + (OUTIL_H - OUTIL_ICONE) / 2, OUTIL_ICONE, encre);
    }

    /**
     * Le trait vertical qui longe la colonne.
     *
     * <p>Mesure sur les titres eux-memes plutot que pose a une hauteur fixe: la
     * colonne suit le bas de la fenetre, et un trait fixe s'en serait decroche
     * a la premiere redimension.
     */
    private void rail(DrawContext context, Saison saison) {
        int haut = Integer.MAX_VALUE;
        int bas = Integer.MIN_VALUE;

        for (Bouton bouton : boutons) {
            if (bouton.genre() != Genre.TITRE) {
                continue;
            }
            haut = Math.min(haut, bouton.y());
            bas = Math.max(bas, bouton.y() + bouton.h());
        }

        if (haut > bas) {
            return;
        }

        boolean saisonniere = saison == Saison.HALLOWEEN;
        int pied = bas + 10;

        // Le trait est un aplat et non une texture: toutes ses rangees sont
        // identiques, donc l'etirer ne le deforme pas -- mais le dessin fourni
        // fait une hauteur fixe, alors que la colonne suit celle de la fenetre.
        // Seul le pied, qui lui ne s'etire pas, vaut d'etre une image.
        context.fill(RAIL_X, haut - 6, RAIL_X + 1, pied,
            saisonniere ? Decor.RAIL_SAISON : MenuTheme.CARD_BORDER);

        if (saisonniere) {
            Decor.railPied(context, RAIL_X, pied);
            return;
        }

        // Hors saison le pied est trace, faute d'un dessin pour la gamme
        // Nocturne: le meme carre creux prolonge d'un ergot.
        int cote = 5;
        int gauche = RAIL_X - cote / 2;
        MenuTheme.outline(context, gauche, pied, cote, cote, 0, MenuTheme.CARD_BORDER);
        context.fill(gauche + cote, pied + cote / 2, gauche + cote + 7, pied + cote / 2 + 1,
            MenuTheme.CARD_BORDER);
    }

    /**
     * Une icone, teintee.
     *
     * <p>Les fichiers sont blancs: c'est la teinte qui donne la couleur, ce
     * qui evite un fichier par etat et garde le survol d'accord avec le reste
     * de l'ecran.
     */
    private void dessineIcone(
        DrawContext context, String nom, int x, int y, int taille, int couleur) {
        try {
            Platforms.get().drawTexture(context, icone(nom), x, y, taille, taille,
                ICONE_TEXTURE, ICONE_TEXTURE, couleur);
        } catch (RuntimeException echec) {
            signale("icones pas encore pretes", echec);
        }
    }

    /** Qui est connecte, en haut a droite, comme sur la maquette. */
    private void pastilleCompte(
        DrawContext context, MinecraftClient client, int accent, Saison saison) {
        String pseudo = client.getSession().getUsername();
        int largeur = Math.min(140, font.getWidth(pseudo) + 16);
        largeurPastille = largeur;
        int x = width - 8 - largeur;
        gauchePastille = x;

        boolean cliquable = etatPresence() == PresenceService.Etat.HORS_LIGNE;
        boolean survole = cliquable && MenuTheme.inside(mouseX, mouseY, x, 8, largeur, 18);

        MenuTheme.panel(context, x, 8, largeur, 18,
            survole ? MenuTheme.CARD_HOVER : MenuTheme.CARD);
        MenuTheme.outline(context, x, 8, largeur, 18,
            survole ? accent : MenuTheme.CARD_BORDER);

        // Le carre dit si le service Paranoia repond: vert quand la session est
        // valide, rouge quand le dernier cycle a echoue, neutre tant que le
        // premier n'est pas passe.
        context.fill(x + 5, 15, x + 9, 19, couleurEtat());
        MenuTheme.text(context, font, MenuTheme.fit(font, pseudo, largeur - 16),
            x + 13, 13, MenuTheme.TEXT);

        int y = 30;
        String dit = libelleEtat();
        if (dit != null) {
            MenuTheme.right(context, font, dit, 0, width - 8, y,
                cliquable ? accent : MenuTheme.TEXT_DIM);
            y += 12;
        }

        // Le compte a rebours sous le pseudonyme, la ou la maquette le pose.
        if (saison == Saison.HALLOWEEN) {
            MenuTheme.right(context, font, Saison.bandeau(LocalDate.now()),
                0, width - 8, y, accent);
        }

        listeDesComptes(context, accent, hautListeComptes());
    }

    /**
     * Le haut de la liste des comptes.
     *
     * <p>Une seule source pour le dessin et pour le clic. La liste est posee
     * sous deux lignes facultatives -- l'etat du service, le compte a rebours
     * de la saison -- ce qui fait deux occasions de diverger si les deux
     * cotes comptaient chacun de leur cote. C'est ainsi qu'une zone cliquable
     * finit ailleurs que ce qu'elle doit atteindre.
     */
    private int hautListeComptes() {
        int y = 30;
        if (libelleEtat() != null) {
            y += 12;
        }
        if (saison() == Saison.HALLOWEEN) {
            y += 12;
        }
        return y;
    }

    /** Largeur de la liste des comptes, au dessin comme au clic. */
    private static final int LISTE_L = 140;

    /**
     * Les comptes enregistres par le launcher, sous la pastille.
     *
     * <p>Le jeu ne connait que celui avec lequel il a demarre; le launcher les
     * connait tous. En designer un ici ne change rien a la partie en cours --
     * la session de Minecraft est fixee au demarrage -- mais le launcher
     * relira ce choix au lancement suivant, et c'est dit sous la liste.
     */
    private void listeDesComptes(DrawContext context, int accent, int haut) {
        if (!comptesDeplies) {
            return;
        }

        int x = width - 8 - LISTE_L;
        List<Comptes.Compte> comptes = Comptes.connus();
        if (comptes.isEmpty()) {
            MenuTheme.right(context, font, "Launcher injoignable",
                0, width - 8, haut, MenuTheme.TEXT_DIM);
            return;
        }

        int ligne = 16;
        int y = haut;

        for (Comptes.Compte compte : comptes) {
            boolean survole = MenuTheme.inside(mouseX, mouseY, x, y, LISTE_L, ligne);
            if (survole || compte.actif()) {
                MenuTheme.panel(context, x, y, LISTE_L, ligne,
                    compte.actif() ? voile(accent) : MenuTheme.CARD_HOVER);
            }
            MenuTheme.text(context, font,
                MenuTheme.fit(font, compte.pseudonyme(), LISTE_L - 10),
                x + 5, y + 4, compte.actif() ? accent : MenuTheme.TEXT);
            y += ligne + 2;
        }

        MenuTheme.right(context, font, "Au prochain lancement",
            0, width - 8, y + 2, MenuTheme.TEXT_DIM);
    }

    /** La meme couleur, assez transparente pour servir de fond a une ligne. */
    private static int voile(int argb) {
        return (argb & 0x00FFFFFF) | 0x55000000;
    }

    private PresenceService.Etat etatPresence() {
        PresenceService presence = ParanoiaClient.presence();
        return presence == null ? PresenceService.Etat.EN_COURS : presence.etat();
    }

    private int couleurEtat() {
        return switch (etatPresence()) {
            case CONNECTE -> VERT;
            case HORS_LIGNE -> MenuTheme.STATE_OFF;
            case EN_COURS -> MenuTheme.TEXT_DIM;
        };
    }

    /**
     * Ce qui est dit sous la pastille, et seulement quand il y a a dire.
     *
     * <p>Rien quand tout va bien: un « Connecte » permanent n'apprend rien et
     * occupe un coin de l'ecran pour le plaisir.
     */
    private String libelleEtat() {
        return switch (etatPresence()) {
            case CONNECTE -> null;
            case HORS_LIGNE -> "Service Paranoia injoignable";
            case EN_COURS -> "Connexion...";
        };
    }

    /**
     * Le pied, reuni dans le coin bas droit comme sur la maquette.
     *
     * <p>Les deux moities disaient la meme chose au meme moment depuis les deux
     * coins opposes, et celle de gauche tombait desormais sous la barre
     * d'outils.
     */
    private void pied(DrawContext context) {
        String mention = "PARANOIA CLIENT - MINECRAFT " + Platforms.get().minecraftVersion()
            + " - NON AFFILIE A MOJANG";

        // Reduit, parce que la police du jeu n'a qu'une taille et que celle-ci
        // est celle des titres. Sur la maquette la mention fait a peine plus de
        // la moitie du corps de texte: c'est une mention legale, elle doit etre
        // lisible et rien de plus. Reunie en une seule ligne elle occupait en
        // plus toute la largeur du bas.
        Platforms.get().pushScale(context, PIED_ECHELLE, width - 8, height - 8);
        try {
            // Coordonnees relatives au pivot: le texte remonte de sa propre
            // hauteur et recule de sa propre largeur pour que son coin bas
            // droit tombe sur le point d'ancrage.
            MenuTheme.text(context, font, mention,
                -font.getWidth(mention), -font.fontHeight, MenuTheme.TEXT_DIM);
        } finally {
            Platforms.get().popScale(context);
        }
    }

    // --------------------------------------------------------------- position

    /**
     * Repose les boutons pour la taille courante.
     *
     * <p>A chaque image, et non une fois: la fenetre se redimensionne, et une
     * disposition calculee une seule fois laisserait les zones cliquables la ou
     * les boutons ne sont plus.
     */
    private void dispose(Saison saison) {
        boutons.clear();

        int hauteurJouer = (int) (font.fontHeight * ECHELLE_JOUER);
        int hauteurTitre = (int) (font.fontHeight * ECHELLE_TITRE);

        // Le bloc ne monte jamais dans le logo: sur une fenetre basse il
        // descend avec lui plutot que de lui passer dessus.
        int y = Math.max(hautLogo() + LOGO_H + LOGO_ECART, hautColonne());

        y = titre(Action.SOLO, "JOUER", ECHELLE_JOUER, hauteurJouer, y, false);
        y = titre(Action.MULTI, "MULTIJOUEUR", ECHELLE_TITRE, hauteurTitre, y, false);
        y = titre(Action.PARANOIA, "PARANOIA", ECHELLE_TITRE, hauteurTitre, y, false);
        y = titre(Action.BOUTIQUE, "BOUTIQUE", ECHELLE_TITRE, hauteurTitre, y, true);
        titre(Action.QUITTER, "QUITTER", ECHELLE_TITRE, hauteurTitre, y, false);

        outils(saison);
    }

    /**
     * Pose un titre, et rend le haut du suivant.
     *
     * <p>La largeur est celle du texte a son echelle de repos: c'est la zone
     * cliquable, et elle ne doit pas suivre le grossissement du survol.
     */
    private int titre(
        Action action, String label, float echelle, int hauteur, int y, boolean boutique) {
        int largeur = (int) (font.getWidth(label) * echelle);
        boutons.add(new Bouton(action, Genre.TITRE, label, null,
            echelle, TITRE_X, y, largeur, hauteur, boutique));
        return y + hauteur + TITRE_ECART;
    }

    /** La barre du bas: ce qui se regle sans quitter l'ecran. */
    private void outils(Saison saison) {
        int x = TITRE_X - 2;
        int y = height - OUTIL_FOND;

        x = outil(Action.OPTIONS, "OPTIONS", "options", x, y);
        x = outil(Action.TEINTE, "TEINTE", "teinte", x, y);
        x = outil(Action.PANORAMA, "PANORAMA", "panorama", x, y);

        // Le bouton de saison n'apparait que lorsqu'il a quelque chose a dire:
        // pendant la fenetre d'Halloween, ou quand le joueur l'a forcee hors
        // saison pour pouvoir la couper. Le reste de l'annee la barre est celle
        // de toujours, et rien n'annonce une saison qui n'est pas la.
        if (saison == Saison.HALLOWEEN || Saison.estLaSaison(LocalDate.now())) {
            outil(Action.HALLOWEEN, "HALLOWEEN", "halloween", x, y);
        }
    }

    private int outil(Action action, String label, String icone, int x, int y) {
        int largeur = font.getWidth(label) + 4 + OUTIL_ICONE;
        boutons.add(new Bouton(action, Genre.OUTIL, label, icone,
            1.0f, x, y, largeur, OUTIL_H, false));
        return x + largeur + OUTIL_ECART;
    }

    // ----------------------------------------------------------------- souris

    public boolean mouseClicked(int button) {
        if (button != 0) {
            return false;
        }

        // La pastille de compte et sa liste sont dessinees a part des autres
        // boutons -- elles portent des pseudonymes, pas des libelles -- donc
        // leurs clics se traitent a part.
        if (MenuTheme.inside(mouseX, mouseY, gauchePastille, 8, largeurPastille, 18)) {
            // Un service injoignable: le clic sert d'abord a reessayer. C'est
            // ce que le joueur veut a cet instant, et le libelle rouge le dit.
            if (etatPresence() == PresenceService.Etat.HORS_LIGNE) {
                PresenceService presence = ParanoiaClient.presence();
                if (presence != null) {
                    presence.reveille();
                }
                return true;
            }

            comptesDeplies = !comptesDeplies;
            if (comptesDeplies) {
                Comptes.rafraichit();
            }
            return true;
        }

        if (comptesDeplies && compteClique()) {
            return true;
        }

        for (Bouton bouton : boutons) {
            if (MenuTheme.inside(mouseX, mouseY, bouton.x(), bouton.y(), bouton.w(), bouton.h())) {
                execute(bouton.action());
                return true;
            }
        }
        return false;
    }

    /**
     * Un clic dans la liste des comptes, s'il y en a un.
     *
     * <p>La liste est posee au dessin, et les memes mesures servent ici. Les
     * recalculer serait les ecrire deux fois, et c'est ainsi qu'une zone
     * cliquable finit ailleurs que son bouton.
     */
    private boolean compteClique() {
        List<Comptes.Compte> comptes = Comptes.connus();
        if (comptes.isEmpty()) {
            return false;
        }

        int x = width - 8 - LISTE_L;
        int y = hautListeComptes();
        for (Comptes.Compte compte : comptes) {
            if (MenuTheme.inside(mouseX, mouseY, x, y, LISTE_L, 16)) {
                Comptes.choisit(compte.id());
                return true;
            }
            y += 18;
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
            case HALLOWEEN -> {
                MenuAccueilModule reglages = MenuAccueilModule.instance();
                if (reglages != null) {
                    reglages.saisonSuivante();
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

    /** La saison reellement dessinee, preference du joueur comprise. */
    private Saison saison() {
        MenuAccueilModule reglages = MenuAccueilModule.instance();
        Saison choix = reglages == null ? Saison.AUTO : reglages.saison();
        return choix.resolue(LocalDate.now());
    }

    /**
     * La couleur d'accent de l'ecran.
     *
     * <p>Halloween impose la sienne et suspend la teinte choisie. C'est le seul
     * endroit ou une saison prend le pas sur un reglage, et il se defend: une
     * saison qui laisserait l'accent violet ne serait plus une saison. Le bouton
     * HALLOWEEN de la barre sert a la couper, et la teinte revient avec.
     */
    private int accent(Saison saison) {
        return saison == Saison.HALLOWEEN ? Decor.ORANGE : teinte().argb();
    }
}

package gg.paranoia.client.title;

import gg.paranoia.client.platform.Platforms;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.Identifier;

/**
 * Les decorations de saison, posees autour de l'ecran d'accueil.
 *
 * <p>Des textures et non des rectangles, contrairement au reste du menu: une
 * toile d'araignee ou une chauve-souris faites de {@code fill} demanderaient
 * cent appels pour un resultat approximatif, alors que le dessin d'une texture
 * passe deja par la plateforme -- c'est le chemin du logo, celui dont on sait
 * qu'il marche.
 *
 * <p>Les fichiers sont du pixel art a leur resolution d'affichage, et chacun
 * est dessine a un <em>multiple entier</em> de sa taille. C'est la seule regle
 * qui compte ici: le jeu echantillonne au plus proche voisin, donc un facteur
 * fractionnaire garderait deux rangees de texels sur trois et en doublerait une
 * -- le trait cesserait d'etre regulier, et un dessin dont toute l'allure tient
 * a la regularite de ses pixels se mettrait a baver. La premiere version
 * dessinait a 68, 26, 20: aucune de ces tailles n'etait un multiple de la
 * source.
 *
 * <p>Toute erreur de dessin est avalee. Une decoration est ce qu'il y a de plus
 * accessoire sur cet ecran, et le pire echec imaginable ici est un plantage de
 * l'ecran-titre -- c'est-a-dire un jeu qui ne demarre plus du tout.
 */
public final class Decor {
    /**
     * L'orange de la saison, repris tel quel du launcher.
     *
     * <p>La valeur vient de {@code styles.css}, comme toute la gamme Nocturne.
     * C'est le seul moyen que les deux moities du client restent d'accord: les
     * rapprocher a l'oeil, c'est reconduire sous une autre forme la derive que
     * la verification de palette existe pour empecher.
     */
    public static final int ORANGE = 0xFFED8725;

    /**
     * Le trait du rail, en saison.
     *
     * <p>Couleur et opacite relevees dans le dessin fourni -- {@code #FC8731} a
     * mi-opacite -- et non choisies a cote de lui.
     */
    public static final int RAIL_SAISON = 0x80FC8731;

    /** Les dessins sont deja colores: rien a teinter. */
    private static final int TEL_QUEL = 0xFFFFFFFF;

    private static final Identifier TOILE = decor("toile");
    private static final Identifier ARAIGNEE = decor("araignee");
    private static final Identifier LUNE = decor("lune");
    private static final Identifier CITROUILLE = decor("citrouille");
    private static final Identifier RAIL_PIED = decor("rail-pied");
    private static final Identifier[] CHAUVE_SOURIS = {
        decor("chauve-souris-1"), decor("chauve-souris-2"),
    };

    /* Tailles des fichiers, en texels. */
    private static final int CARRE_32 = 32;
    private static final int CARRE_16 = 16;
    private static final int BAT_L = 16;
    private static final int BAT_H = 8;
    private static final int PIED_L = 14;
    private static final int PIED_H = 8;

    /** Un tour complet de la traversee, en millisecondes. */
    private static final long TRAVERSEE = 48_000L;
    /** Duree d'une etape du battement d'ailes. */
    private static final long BATTEMENT = 160L;

    /** Ce qui separe le bas des citrouilles du bas de l'ecran. */
    private static final int CITROUILLE_BAS = 18;

    private static final int BRAISES = 26;
    private static final int ETINCELLES = 9;

    private Decor() {
    }

    private static Identifier decor(String nom) {
        return Identifier.of("paranoia_client", "textures/gui/title/decor/" + nom + ".png");
    }

    /**
     * Ce qui se pose derriere l'interface: la toile, la lune, les
     * chauves-souris.
     *
     * <p>Derriere, et non devant: ce sont des elements de ciel. Une
     * chauve-souris qui passerait par-dessus le pseudonyme ou les titres les
     * rendrait illisibles une seconde sur trois, pour rien.
     */
    public static void arriere(DrawContext context, int width, int height) {
        pose(context, TOILE, 0, 0, 64, 64, CARRE_32, CARRE_32, TEL_QUEL);
        araignee(context);

        // La lune est posee sous le bandeau de saison et non a sa hauteur: les
        // deux tirent vers le coin haut droit, et le texte doit rester lisible.
        pose(context, LUNE, width - 150, 46, 64, 64, CARRE_32, CARRE_32, TEL_QUEL);

        // Trois traversees desynchronisees, a deux tailles. A l'unisson elles
        // feraient un logo, pas un vol.
        chauveSouris(context, width, 0L, 58, 2);
        chauveSouris(context, width, 17_000L, 96, 1);
        chauveSouris(context, width, 31_000L, 140, 1);
    }

    /**
     * Ce qui se pose devant: les citrouilles du coin bas droit.
     *
     * <p>Devant, parce qu'elles sont posees au sol de l'ecran et non dans son
     * ciel, et parce que rien ne passe la: la mention legale est une ligne plus
     * bas, la barre d'outils est a l'autre bout.
     */
    public static void avant(DrawContext context, int width, int height) {
        // Deux citrouilles de meme taille, cote a cote, et POSEES AU-DESSUS de
        // la mention legale. Elles la chevauchaient: la grande descendait a
        // seize pixels du bas quand la mention commence a treize.
        int bas = height - CITROUILLE_BAS;
        pose(context, CITROUILLE, width - 70, bas - 32, 32, 32, CARRE_16, CARRE_16, TEL_QUEL);
        pose(context, CITROUILLE, width - 34, bas - 32, 32, 32, CARRE_16, CARRE_16, TEL_QUEL);
    }

    /**
     * L'araignee, pendue a son fil sous la toile.
     *
     * <p>Elle descend et remonte lentement. Le fil est redessine a chaque image
     * jusqu'a elle plutot que d'une longueur fixe: un fil qui ne suit pas la
     * bestiole la laisse flotter sous son extremite.
     */
    private static void araignee(DrawContext context) {
        double phase = System.currentTimeMillis() % 9_000L * 2 * Math.PI / 9_000.0;
        int y = 52 + (int) Math.round((Math.sin(phase) + 1) * 9);

        context.fill(45, 30, 46, y, 0x66E9E9ED);
        pose(context, ARAIGNEE, 41, y, 16, 16, 8, 8, TEL_QUEL);
    }

    /**
     * Les braises et les etincelles.
     *
     * <p>Aucun etat garde d'une image a l'autre: la position de chaque braise
     * est une fonction du temps et de son numero. Une liste de particules
     * vivantes aurait demande un tick -- que cet ecran n'a pas -- et aurait
     * grossi tant que l'ecran reste ouvert.
     */
    public static void braises(DrawContext context, int width, int height) {
        long t = System.currentTimeMillis();

        for (int i = 0; i < BRAISES; i++) {
            // Deux nombres premiers differents par braise: les colonnes ne se
            // rangent pas, et les montees ne se synchronisent pas.
            int colonne = (i * 977) % Math.max(1, width);
            long duree = 7_000L + (i * 613L) % 5_000L;
            double part = ((t + i * 1_237L) % duree) / (double) duree;

            int y = height - (int) (part * (height * 0.55));
            int x = colonne + (int) Math.round(Math.sin(part * 6.3 + i) * 6);

            // Elle s'eteint en montant: une braise qui garde son eclat jusqu'en
            // haut de l'ecran ressemble a une poussiere, pas a une flammeche.
            int alpha = (int) (200 * (1 - part));
            if (alpha < 12) {
                continue;
            }
            int couleur = (alpha << 24) | (ORANGE & 0x00FFFFFF);
            context.fill(x, y, x + 1 + (i % 2), y + 1 + (i % 2), couleur);
        }

        for (int i = 0; i < ETINCELLES; i++) {
            long cycle = 2_600L + (i * 431L) % 1_900L;
            double part = ((t + i * 877L) % cycle) / (double) cycle;

            // Un scintillement, pas un clignotement: l'eclat monte puis
            // redescend, et l'etincelle passe la moitie du cycle invisible.
            double eclat = Math.sin(part * Math.PI);
            if (eclat < 0.35) {
                continue;
            }
            int x = (i * 1_361) % Math.max(1, width);
            int y = 40 + (i * 523) % Math.max(1, (int) (height * 0.6));
            int couleur = ((int) (235 * eclat) << 24) | 0x00FFE2B0;

            // Une petite croix: deux traits d'un pixel. Un carre se lirait
            // comme une braise de plus.
            context.fill(x - 2, y, x + 3, y + 1, couleur);
            context.fill(x, y - 2, x + 1, y + 3, couleur);
        }
    }

    /**
     * Le pied du rail: le petit carre creux et son ergot.
     *
     * @param x colonne du trait. Le dessin entre par sa troisieme colonne, d'ou
     *     le recul: cale sur son bord, le carre serait decentre du trait.
     */
    public static void railPied(DrawContext context, int x, int y) {
        pose(context, RAIL_PIED, x - 2, y, PIED_L, PIED_H, PIED_L, PIED_H, TEL_QUEL);
    }

    /**
     * Une chauve-souris qui traverse l'ecran, ailes battantes.
     *
     * <p>Le temps absolu, et non un compteur d'images: la traversee garde la
     * meme duree et le battement la meme cadence quel que soit le nombre
     * d'images par seconde, comme la bande qui defile en fond.
     *
     * <p>Le battement est decale par la position de la bestiole et pas seulement
     * par son retard de depart. Deux chauves-souris parties a des moments
     * differents mais a la meme cadence finissent sinon par battre ensemble, et
     * le vol redevient un metronome.
     */
    private static void chauveSouris(
        DrawContext context, int width, long decalage, int hauteur, int facteur) {
        long maintenant = System.currentTimeMillis();
        long temps = (maintenant + decalage) % TRAVERSEE;

        int larg = BAT_L * facteur;
        int haut = BAT_H * facteur;

        // La course part d'une largeur hors de l'ecran et y finit: la bestiole
        // entre et sort au lieu d'apparaitre et de disparaitre sur place.
        int course = width + larg * 2;
        int x = (int) (temps * course / TRAVERSEE) - larg;

        // Un leger roulis vertical. Sans lui le vol est un glissement.
        double phase = temps * 2 * Math.PI / 6_000.0;
        int y = hauteur + (int) Math.round(Math.sin(phase) * 5);

        int etape = (int) (((maintenant + decalage) / BATTEMENT + x) % CHAUVE_SOURIS.length);
        pose(context, CHAUVE_SOURIS[etape], x, y, larg, haut, BAT_L, BAT_H, TEL_QUEL);
    }

    private static void pose(
        DrawContext context, Identifier texture,
        int x, int y, int larg, int haut, int texLarg, int texHaut, int teinte) {
        try {
            Platforms.get().drawTexture(
                context, texture, x, y, larg, haut, texLarg, texHaut, teinte);
        } catch (RuntimeException echec) {
            // Silencieux, et c'est le seul endroit du mod ou ca se defend: la
            // texture peut ne pas encore exister a la premiere image, le cas se
            // reglera de lui-meme a la suivante, et il n'y a rien que le joueur
            // puisse faire d'un avertissement sur une citrouille.
        }
    }
}

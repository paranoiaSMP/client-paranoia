package gg.paranoia.client.title;

import gg.paranoia.client.menu.MenuTheme;
import gg.paranoia.client.modules.MenuAccueilModule;
import gg.paranoia.client.platform.Platforms;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.util.Identifier;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;

/**
 * L'habillage d'Halloween de l'ecran d'accueil.
 *
 * <p>Meme regle que dans le launcher: il ne deplace rien. Les boutons gardent
 * leur place et leur taille, seules leurs couleurs changent, et tout ce qui
 * est ajoute -- chauves-souris, toile, braises, citrouilles -- est decoratif
 * et ne capte aucun clic.
 *
 * <p>Il ne se sert que de ce que {@link TitleController} utilise deja --
 * {@code fill} et {@code Platforms.drawTexture} -- pour ne pas ajouter une
 * seule API dont la signature pourrait changer d'une version a l'autre.
 *
 * <p>Les sprites sont en pixel art a 16 texels, dessines a 16 unites
 * d'interface: un texel vaut exactement un point, donc deux pixels a
 * l'echelle 2, et le trace reste net au plus proche voisin.
 */
public final class Halloween {
    /** L'accent citrouille, la meme valeur que dans le launcher. */
    public static final int CITROUILLE = 0xFFFC8731;
    /** Le texte chaud du launcher en habillage d'Halloween. */
    public static final int ENCRE = 0xFFF1EAE1;

    /** Le voile, vire a la prune: le bleu de Nocturne jurait avec l'orange. */
    static final int VOILE = 0x99160D15;
    static final int VOILE_PLEIN = 0xF2160D15;
    static final int BARRE = 0xFF1C1219;
    static final int BARRE_SURVOL = 0xFF2C1C26;
    static final int BARRE_BORD = 0x40FC8731;

    static final Identifier LOGO = tex("logo");
    static final int LOGO_TEXTURE_L = 176;
    static final int LOGO_TEXTURE_H = 122;

    static final Identifier ICONE = tex("icone");
    private static final Identifier CITROUILLE_TEX = tex("citrouille");
    private static final Identifier LUEUR = tex("citrouille_lueur");
    private static final Identifier[] CHAUVE_SOURIS = {tex("chauve_souris_0"), tex("chauve_souris_1")};
    private static final Identifier TOILE = tex("toile");
    private static final Identifier ARAIGNEE = tex("araignee");
    private static final Identifier LUNE = tex("lune");

    private static Identifier tex(String nom) {
        return Identifier.of("paranoia_client", "textures/gui/title/halloween/" + nom + ".png");
    }

    private Halloween() {
    }

    // ---------------------------------------------------------------- periode

    /**
     * Du 15 octobre au 2 novembre inclus, comme le launcher. Le 2 et non le
     * 1er: la soiree du 31 finit apres minuit.
     */
    public static boolean enPeriode() {
        return enPeriode(LocalDate.now());
    }

    static boolean enPeriode(LocalDate jour) {
        int mois = jour.getMonthValue();
        int j = jour.getDayOfMonth();
        return (mois == 10 && j >= 15) || (mois == 11 && j <= 2);
    }

    /** En periode, et pas coupe par le joueur. */
    public static boolean actif() {
        if (!enPeriode()) {
            return false;
        }
        MenuAccueilModule reglages = MenuAccueilModule.instance();
        return reglages == null || reglages.halloween();
    }

    /** « Halloween dans 13 jours », « Halloween, c'est ce soir », ou null une fois passe. */
    static String compteARebours() {
        LocalDate aujourdhui = LocalDate.now();
        long jours = ChronoUnit.DAYS.between(aujourdhui, LocalDate.of(aujourdhui.getYear(), 10, 31));
        if (jours < 0) {
            return null;
        }
        if (jours == 0) {
            return "Halloween, c'est ce soir";
        }
        if (jours == 1) {
            return "Halloween, c'est demain soir";
        }
        return "Halloween dans " + jours + " jours";
    }

    // ------------------------------------------------------------------ decor

    /**
     * Ce qui se pose entre le panorama et les boutons: la brume orangee du
     * bas, les braises qui montent, et les chauves-souris du haut.
     */
    static void arrierePlan(DrawContext context, int width, int height, long ms) {
        lune(context, width);
        brume(context, width, height);
        braises(context, width, height, ms);
        chauvesSouris(context, width, height, ms);
    }

    /**
     * Ce qui se pose par-dessus: la toile du coin haut gauche et son
     * araignee, puis deux citrouilles en bas a droite, au-dessus du pied de
     * page. Le coin haut droit est pris par le cartouche du joueur, et le bas
     * gauche par les raccourcis.
     */
    static void premierPlan(DrawContext context, int width, int height, long ms) {
        toile(context, ms);
        // Au double, comme la lune: a seize points elles se perdaient dans
        // le coin, a cote d'un pied de page plus large qu'elles.
        citrouille(context, width - 84, height - 50, 32, ms, 0);
        citrouille(context, width - 48, height - 46, 32, ms, 700);
    }

    /**
     * Une lueur de feu au ras du sol, en bandes.
     *
     * <p>En bandes et non en degrade: {@code fillGradient} n'est pas dans la
     * liste des API verifiees par la sonde, et des paliers de quatre points se
     * fondent dans le pixel art au lieu de jurer avec lui.
     */
    private static void brume(DrawContext context, int width, int height) {
        int bandes = 16;
        int pas = 5;
        for (int i = 0; i < bandes; i++) {
            int alpha = (i + 1) * 0x2C / bandes;
            int y = height - (bandes - i) * pas;
            context.fill(0, y, width, y + pas, (alpha << 24) | (CITROUILLE & 0x00FFFFFF));
        }
    }

    /** Une vingtaine de braises qui montent en ondulant et s'eteignent en route. */
    private static void braises(DrawContext context, int width, int height, long ms) {
        int hauteur = Math.max(1, height * 3 / 5);
        for (int i = 0; i < 22; i++) {
            // Un melange entier fixe par braise: positions et vitesses varient,
            // mais restent les memes d'une image a l'autre.
            int graine = i * 0x9E3779B1;
            int x0 = Math.floorMod(graine >>> 7, Math.max(1, width));
            int vitesse = 9 + Math.floorMod(graine >>> 13, 14);       // points par seconde
            int decalage = Math.floorMod(graine >>> 3, hauteur);
            int monte = (int) Math.floorMod(ms * vitesse / 1000 + decalage, (long) hauteur);

            int y = height - monte;
            int x = x0 + (int) Math.round(Math.sin((ms / 900.0) + i) * 3);
            int alpha = 0xD0 * (hauteur - monte) / hauteur;
            int taille = (i % 4 == 0) ? 2 : 1;
            int couleur = (i % 3 == 0) ? 0xFFD27A : (CITROUILLE & 0x00FFFFFF);
            context.fill(x, y, x + taille, y + taille, (alpha << 24) | couleur);
        }
    }

    /**
     * Une lune de recolte en haut a gauche du logo.
     *
     * <p>Elle n'est pas la que pour l'ambiance: les panoramas sont des ciels de
     * nuit, et une chauve-souris sombre sur un ciel sombre ne se voit pas. Sa
     * trajectoire passe devant la lune, et c'est la qu'on la remarque.
     *
     * <p>Texture de 32 dessinee a 64: deux points par texel, l'echelle des
     * blocs de Minecraft plutot que celle de l'interface.
     */
    private static void lune(DrawContext context, int width) {
        // A droite: la gauche de l'ecran est au menu, et assombrie pour lui.
        dessine(context, LUNE, width - 190, 40, 64, 64, 32, 32, 0xC8FFFFFF);
    }

    /**
     * Trois chauves-souris, de droite a gauche, chacune a son rythme.
     *
     * <p>La premiere est dessinee au double, comme si elle etait plus pres: a
     * taille unique, elles se lisaient comme un motif repete.
     */
    private static void chauvesSouris(DrawContext context, int width, int height, long ms) {
        int[] periodes = {17_000, 23_000, 29_000};
        int[] hauteurs = {height / 9, height / 5, height / 14};
        int[] alphas = {0xFF, 0xDD, 0xAA};
        int[] echelles = {2, 1, 1};
        for (int i = 0; i < periodes.length; i++) {
            double avance = Math.floorMod(ms + i * 7_000L, (long) periodes[i]) / (double) periodes[i];
            int x = (int) (width + 20 - avance * (width + 40));
            int y = hauteurs[i] + (int) Math.round(Math.sin(avance * Math.PI * 6 + i) * 7);
            // Un battement toutes les 140 ms, decale pour qu'elles ne battent pas ensemble.
            int image = (int) Math.floorMod((ms + i * 50L) / 140, 2L);
            int e = echelles[i];
            dessine(context, CHAUVE_SOURIS[image], x, y, 16 * e, 8 * e, 16, 8,
                (alphas[i] << 24) | 0xFFFFFF);
        }
    }

    /** La toile dans le coin haut gauche, et l'araignee qui monte et descend. */
    private static void toile(DrawContext context, long ms) {
        // 32 texels dessines a 64, comme la lune.
        dessine(context, TOILE, 0, 0, 64, 64, 32, 32, 0xFFFFFFFF);

        int fil = 26 + (int) Math.round((Math.sin(ms / 1400.0) + 1) * 9);
        int x = 25;
        context.fill(x, 0, x + 1, fil, 0x99CDC4CA);
        dessine(context, ARAIGNEE, x - 8, fil, 16, 16, 8, 8, 0xFFFFFFFF);
    }

    /**
     * Une citrouille et sa bougie.
     *
     * <p>La lueur est une texture a part, posee par-dessus avec une opacite
     * qui vacille: le corps ne bouge pas, seule la flamme vit.
     */
    static void citrouille(DrawContext context, int x, int y, int taille, long ms, int phase) {
        dessine(context, CITROUILLE_TEX, x, y, taille, taille, 16, 16, 0xFFFFFFFF);
        double t = (ms + phase) / 1000.0;
        double flamme = 0.78 + 0.14 * Math.sin(t * 7.3) + 0.08 * Math.sin(t * 17.9);
        int alpha = (int) Math.max(0x60, Math.min(0xFF, flamme * 0xFF));
        dessine(context, LUEUR, x, y, taille, taille, 16, 16, (alpha << 24) | 0xFFFFFF);
    }

    /** Le compte a rebours, aligne a droite sous le cartouche du joueur. */
    static void compte(DrawContext context, TextRenderer font, int droite, int y) {
        String texte = compteARebours();
        if (texte != null) {
            MenuTheme.right(context, font, texte, 0, droite, y, CITROUILLE);
        }
    }

    /**
     * Comme dans le controleur: une texture absente a la premiere image ne
     * doit pas faire tomber l'ecran-titre. Un decor manquant n'a rien a dire
     * au joueur.
     */
    private static void dessine(DrawContext context, Identifier texture,
                                int x, int y, int w, int h, int texW, int texH, int teinte) {
        try {
            Platforms.get().drawTexture(context, texture, x, y, w, h, texW, texH, teinte);
        } catch (RuntimeException pasPret) {
            // Le rechargement des ressources est en cours; l'image suivante le dessinera.
        }
    }
}

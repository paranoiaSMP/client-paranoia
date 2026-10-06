package gg.paranoia.client.title;

import net.minecraft.client.gui.CubeMapRenderer;
import net.minecraft.client.texture.TextureManager;
import net.minecraft.util.Identifier;
import org.slf4j.LoggerFactory;

/**
 * Les fonds de l'ecran d'accueil.
 *
 * <p>Un panorama est un cubemap: six images, une par face, que le jeu plaque
 * autour de la camera et fait tourner lentement. L'identifiant designe leur
 * prefixe commun -- le jeu y ajoute {@code _0.png} a {@code _5.png}.
 *
 * <p>Ajouter un panorama demande donc deux gestes et rien de plus: une
 * constante ici, et six images sous
 * {@code assets/paranoia_client/textures/gui/title/<nom>/}. Il apparait alors
 * dans le reglage, et le bouton de l'ecran d'accueil le fait defiler.
 *
 * <p>Les six images se prennent dans le jeu, et non a la main: le menu de
 * debogage de Minecraft ecrit un cubemap complet d'un seul geste, six fichiers
 * deja nommes {@code panorama_0.png} a {@code panorama_5.png}, pris au meme
 * endroit et exactement a quatre-vingt-dix degres les uns des autres. C'est la
 * seule facon d'avoir des coutures qui tombent juste -- quatre captures prises
 * a la souris ne se recollent jamais.
 *
 * <p>{@code VANILLA} reste en premier choix de secours: ses six faces sont
 * fournies par le jeu, donc toujours presentes, meme si une version de
 * Minecraft arrivait sans les notres.
 */
public enum Panorama {
    SPAWN("Spawn", Identifier.of("paranoia_client", "textures/gui/title/spawn/panorama"), 1024),
    NOCTURNE("Nocturne", Identifier.of("paranoia_client", "textures/gui/title/nocturne/panorama"), 512),
    VANILLA("Minecraft", Identifier.of("minecraft", "textures/gui/title/background/panorama"), 1024);

    private final String label;
    private final Identifier cubeMap;
    private final int face;

    Panorama(String label, Identifier cubeMap, int face) {
        this.label = label;
        this.cubeMap = cubeMap;
        this.face = face;
    }

    public String label() {
        return label;
    }

    public Identifier cubeMap() {
        return cubeMap;
    }

    /** Cote d'une face, en texels: la premiere sert de fond de secours. */
    public int tailleFace() {
        return face;
    }

    /**
     * Une face, comme image seule.
     *
     * <p>Le cubemap est un chemin de rendu a lui tout seul, et il peut ne pas
     * aboutir. Les faces, elles, sont de simples images que
     * {@code drawTexture} sait dessiner -- c'est le meme chemin que le logo,
     * et il marche. Les quatre premieres sont les horizons, dans l'ordre; les
     * deux dernieres le zenith et le nadir.
     */
    public Identifier face(int numero) {
        return Identifier.of(cubeMap.getNamespace(), cubeMap.getPath() + "_" + numero + ".png");
    }

    /**
     * Inscrit les textures des trois panoramas, le plus tot possible.
     *
     * <p>C'est la correction du panorama qui restait noir, et elle vient du
     * bytecode plutot que d'une supposition. {@code registerTextures} ne pose
     * pas six faces: il construit une seule {@code CubemapTexture} et
     * l'inscrit sous l'identifiant de base, et {@code draw} va la rechercher
     * par ce meme identifiant. Or une texture rechargeable inscrite
     * <em>apres</em> le rechargement des ressources n'est jamais chargee --
     * son enveloppe GPU reste vide, et le dessin echoue a chaque image.
     *
     * <p>L'ecran-titre du jeu fait exactement cela au demarrage du client, par
     * {@code TitleScreen.registerTextures}, donc avant le premier
     * rechargement. On s'y prend au meme moment.
     *
     * <p>Le {@code CubeMapRenderer} construit ici ne sert qu'a l'inscription
     * et rend son tampon aussitot: ce qui reste, c'est la texture, dans le
     * gestionnaire.
     *
     * <p>Tout est sous reserve. Rien ici ne doit empecher le jeu de demarrer:
     * au pire le panorama manque, et l'ecran garde son aplat.
     */
    public static void enregistreLesTextures(TextureManager textures) {
        for (Panorama panorama : values()) {
            try (CubeMapRenderer cube = new CubeMapRenderer(panorama.cubeMap())) {
                cube.registerTextures(textures);
            } catch (RuntimeException echec) {
                LoggerFactory.getLogger("ParanoiaClient").info(
                    "[ACCUEIL] panorama {} non inscrit: {}",
                    panorama.label(), echec.getMessage());
            }
        }
    }
}

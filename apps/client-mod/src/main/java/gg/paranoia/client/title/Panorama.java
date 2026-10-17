package gg.paranoia.client.title;

import net.minecraft.util.Identifier;

/**
 * Les fonds de l'ecran d'accueil.
 *
 * <p>Six images, prises au meme endroit et a quatre-vingt-dix degres les unes
 * des autres: quatre horizons, un zenith, un nadir. L'identifiant designe leur
 * prefixe commun -- le numero et {@code .png} s'y ajoutent.
 *
 * <p>Elles se prennent dans le jeu, et non a la main: le menu de debogage de
 * Minecraft ecrit un cubemap complet d'un seul geste, six fichiers deja nommes
 * {@code panorama_0.png} a {@code panorama_5.png}. C'est la seule facon
 * d'avoir des coutures qui tombent juste -- quatre captures prises a la souris
 * ne se recollent jamais.
 *
 * <p>Ajouter un panorama demande donc deux gestes et rien de plus: une
 * constante ici, et les six images sous
 * {@code assets/paranoia_client/textures/gui/title/<nom>/}. Il apparait alors
 * dans le reglage, et le bouton de l'ecran d'accueil le fait defiler.
 *
 * <p>L'ecran ne se sert que des quatre horizons: il les pose cote a cote et
 * fait defiler la bande. Le cubemap du jeu, qui les plaquerait autour de la
 * camera avec sa perspective, demande une texture d'un type particulier
 * chargee a un moment precis du demarrage -- hors de portee d'un mod, et
 * dangereuse a tenter: l'inscrire remplace celle du jeu par une copie vide, ce
 * qui faisait planter tous les ecrans qui s'en servent.
 */
public enum Panorama {
    SPAWN("Spawn", Identifier.of("paranoia_client", "textures/gui/title/spawn/panorama"), 1024),
    NOCTURNE("Nocturne", Identifier.of("paranoia_client", "textures/gui/title/nocturne/panorama"), 512),
    VANILLA("Minecraft", Identifier.of("minecraft", "textures/gui/title/background/panorama"), 1024);

    private final String label;
    private final Identifier prefixe;
    private final int taille;

    Panorama(String label, Identifier prefixe, int taille) {
        this.label = label;
        this.prefixe = prefixe;
        this.taille = taille;
    }

    public String label() {
        return label;
    }

    /** Cote d'une face, en texels: il faut le connaitre pour la mettre a l'echelle. */
    public int tailleFace() {
        return taille;
    }

    /** Une face. Les quatre premieres sont les horizons, dans l'ordre. */
    public Identifier face(int numero) {
        return Identifier.of(prefixe.getNamespace(), prefixe.getPath() + "_" + numero + ".png");
    }
}

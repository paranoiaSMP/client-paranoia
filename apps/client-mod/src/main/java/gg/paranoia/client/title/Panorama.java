package gg.paranoia.client.title;

import net.minecraft.util.Identifier;

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
    SPAWN("Spawn", Identifier.of("paranoia_client", "textures/gui/title/spawn/panorama")),
    NOCTURNE("Nocturne", Identifier.of("paranoia_client", "textures/gui/title/nocturne/panorama")),
    VANILLA("Minecraft", Identifier.of("minecraft", "textures/gui/title/background/panorama"));

    private final String label;
    private final Identifier cubeMap;

    Panorama(String label, Identifier cubeMap) {
        this.label = label;
        this.cubeMap = cubeMap;
    }

    public String label() {
        return label;
    }

    public Identifier cubeMap() {
        return cubeMap;
    }
}

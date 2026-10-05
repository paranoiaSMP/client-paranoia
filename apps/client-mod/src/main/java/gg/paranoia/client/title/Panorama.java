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
 * <p>{@code VANILLA} reste en premier choix de secours: ses six faces sont
 * fournies par le jeu, donc toujours presentes, meme si une version de
 * Minecraft arrivait sans les notres.
 */
public enum Panorama {
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

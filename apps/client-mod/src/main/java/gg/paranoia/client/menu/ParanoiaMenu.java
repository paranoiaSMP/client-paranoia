package gg.paranoia.client.menu;

/**
 * Marqueur pose sur l'ecran du menu de chaque version.
 *
 * <p>Le code partage a besoin de reconnaitre son propre ecran pour la bascule
 * Maj droite, sans connaitre la classe concrete qui, elle, depend de la version.
 */
public interface ParanoiaMenu {
    MenuController controller();
}

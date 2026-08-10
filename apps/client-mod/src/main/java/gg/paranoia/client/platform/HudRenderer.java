package gg.paranoia.client.platform;

import net.minecraft.client.gui.DrawContext;

/**
 * Ce que la plateforme appelle a chaque image pour dessiner les HUD en jeu.
 *
 * <p>Volontairement sans delta de tick: le compteur d'images a change de nom de
 * methode entre les versions ciblees, et rien ici n'en avait besoin. Une
 * animation qui en demanderait un jour peut se caler sur
 * {@code System.nanoTime()}, qui ne depend d'aucune version.
 */
@FunctionalInterface
public interface HudRenderer {
    void render(DrawContext context);
}

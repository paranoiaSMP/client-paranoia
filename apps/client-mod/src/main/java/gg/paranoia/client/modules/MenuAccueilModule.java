package gg.paranoia.client.modules;

import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.EnumSetting;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import gg.paranoia.client.title.Panorama;
import gg.paranoia.client.title.Teinte;

/**
 * L'ecran d'accueil Paranoia, a la place de l'ecran-titre de Minecraft.
 *
 * <p>Le module porte les trois choses que le joueur peut changer, et il les
 * porte parce qu'un module est deja ce qui sait se relire au demarrage
 * suivant: un panorama choisi qui redeviendrait celui par defaut a chaque
 * lancement ne serait pas un reglage, seulement un effet.
 *
 * <p>Le desactiver rend l'ecran-titre d'origine, entier. C'est voulu: on
 * remplace un ecran que le joueur connait depuis toujours, et lui laisser le
 * moyen de revenir en arriere coute une ligne.
 */
public final class MenuAccueilModule extends Module {
    /** Le mixin de remplacement s'execute hors du menu: il lui faut un acces direct. */
    private static MenuAccueilModule instance;

    private final BooleanSetting splash =
        add(new BooleanSetting("splash", "Phrase du jour", true));
    private final EnumSetting<Panorama> panorama = add(new EnumSetting<>(
        "panorama", "Panorama", Panorama.NOCTURNE, Panorama.values(), Panorama::label));
    private final EnumSetting<Teinte> teinte = add(new EnumSetting<>(
        "teinte", "Teinte", Teinte.AMETHYSTE, Teinte.values(), Teinte::label));

    public MenuAccueilModule() {
        super("menu-accueil", "Ecran d'accueil", ModuleCategory.VISUEL, true);
        describe("Remplace l'ecran-titre de Minecraft par celui de Paranoia.");
        instance = this;
    }

    /** Null tant que les modules ne sont pas enregistres: le mixin le verifie. */
    public static MenuAccueilModule instance() {
        return instance;
    }

    public boolean splash() {
        return splash.get();
    }

    public Panorama panorama() {
        return panorama.get();
    }

    public Teinte teinte() {
        return teinte.get();
    }

    public void panoramaSuivant() {
        panorama.cycle(1);
    }

    public void teinteSuivante() {
        teinte.cycle(1);
    }
}

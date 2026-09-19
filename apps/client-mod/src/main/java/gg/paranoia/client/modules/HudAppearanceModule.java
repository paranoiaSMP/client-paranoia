package gg.paranoia.client.modules;

import gg.paranoia.client.config.HudFont;
import gg.paranoia.client.config.HudStyle;
import gg.paranoia.client.module.EnumSetting;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;

/**
 * L'allure du HUD, choisie une fois pour tout le client.
 *
 * <p>Le joueur reglait la forme du fond, l'opacite et l'ombre du texte module
 * par module. Onze modules a accorder pour obtenir un ensemble coherent, et
 * tout a refaire pour en changer: personne ne le fait, et le HUD reste sur ses
 * valeurs par defaut.
 *
 * <p>Le reglage par module ne disparait pas pour autant -- il devient une
 * derogation. Voir {@link gg.paranoia.client.config.BackgroundStyle#AUTO}.
 *
 * <p>Le style vit dans un module et non dans un champ de configuration a part:
 * il herite ainsi de la persistance, de l'affichage dans le menu et du
 * parcours au clic, tous trois deja ecrits pour les reglages. Le
 * {@code instance} statique reprend exactement le motif de
 * {@link MenuKeyModule}, pour la meme raison: le dessin doit lire cette valeur
 * a chaque trame, sans avoir a remonter jusqu'au registre.
 */
public final class HudAppearanceModule extends Module {
    private static HudAppearanceModule instance;

    private final EnumSetting<HudStyle> style = add(new EnumSetting<>(
        "style", "Style du HUD", HudStyle.NOCTURNE, HudStyle.values(), HudStyle::label));

    private final EnumSetting<HudFont> font = add(new EnumSetting<>(
        "font", "Police du HUD", HudFont.VANILLA, HudFont.values(), HudFont::label));

    public HudAppearanceModule() {
        super("hudAppearance", "Apparence du HUD", ModuleCategory.PARAMETRES, true);
        instance = this;
    }

    /**
     * @return le style en vigueur, {@link HudStyle#NOCTURNE} tant que le
     *     module n'existe pas encore -- le dessin ne doit jamais dependre de
     *     l'ordre d'enregistrement des modules.
     */
    public static HudStyle style() {
        HudAppearanceModule module = instance;
        return module == null ? HudStyle.NOCTURNE : module.style.get();
    }

    /**
     * @return la police en vigueur, celle du jeu tant que le module n'existe
     *     pas -- meme raison que pour le style.
     */
    public static HudFont font() {
        HudAppearanceModule module = instance;
        return module == null ? HudFont.VANILLA : module.font.get();
    }
}

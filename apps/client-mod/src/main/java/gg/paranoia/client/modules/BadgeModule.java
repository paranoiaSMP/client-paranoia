package gg.paranoia.client.modules;

import gg.paranoia.client.module.ColorSetting;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.EnumSetting;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import gg.paranoia.client.net.ParanoiaUsers;
import net.minecraft.text.MutableText;
import net.minecraft.text.Style;
import net.minecraft.text.Text;
import net.minecraft.text.TextColor;

import java.util.UUID;

/**
 * Marque d'un signe les joueurs qui utilisent le client Paranoia.
 *
 * <p>Le signe est un caractere, pas une texture: charger une image demanderait
 * un identifiant de ressource et une primitive de dessin dont la signature
 * bouge d'une version a l'autre, alors qu'un caractere s'insere dans le nom
 * existant et suit le rendu du jeu partout ou ce nom apparait.
 *
 * <p>Le module ne decide de rien: il affiche ce que contient
 * {@link ParanoiaUsers}, rempli par l'API Paranoia que le mod interroge
 * lui-meme. C'est ce qui fait marcher le badge sur n'importe quel serveur, y
 * compris ceux qui n'ont jamais entendu parler de nous. Tant que rien ne
 * remplit cette liste, aucun badge n'apparait -- en afficher un par defaut
 * reviendrait a affirmer quelque chose qu'on ne sait pas.
 */
public final class BadgeModule extends Module {
    /** Le mixin du tab s'execute dans le rendu: il lui faut un acces direct. */
    private static BadgeModule instance;

    public enum Symbol {
        LOSANGE("Losange", "◆"),
        ETOILE("Etoile", "★"),
        POINT("Point", "●"),
        LETTRE("Lettre P", "P");

        private final String label;
        private final String glyph;

        Symbol(String label, String glyph) {
            this.label = label;
            this.glyph = glyph;
        }

        public String label() {
            return label;
        }

        public String glyph() {
            return glyph;
        }
    }

    private final BooleanSetting inTab =
        add(new BooleanSetting("tab", "Dans la liste des joueurs", true));
    private final BooleanSetting onNameTag =
        add(new BooleanSetting("nametag", "Au-dessus de la tete", true));
    private final EnumSetting<Symbol> symbol = add(new EnumSetting<>(
        "symbol", "Signe", Symbol.LOSANGE, Symbol.values(), Symbol::label));
    private final ColorSetting color =
        add(new ColorSetting("color", "Couleur", 0xFFB07CFF));

    public BadgeModule() {
        super("badge", "Badge Paranoia", ModuleCategory.VISUEL, true);
        instance = this;
    }

    public static BadgeModule instance() {
        return instance;
    }

    public boolean inTab() {
        return inTab.get();
    }

    public boolean onNameTag() {
        return onNameTag.get();
    }

    /**
     * Ajoute le badge devant un nom, si ce joueur est un utilisateur declare.
     *
     * @return le nom d'origine quand il n'y a rien a ajouter -- jamais null.
     */
    public static Text decorate(Text name, UUID uuid, boolean tab) {
        BadgeModule module = instance();
        if (module == null || !module.enabled() || name == null) {
            return name;
        }
        if (!(tab ? module.inTab() : module.onNameTag())) {
            return name;
        }
        if (!ParanoiaUsers.isUser(uuid)) {
            return name;
        }

        MutableText badge = Text.literal(module.symbol.get().glyph() + " ");
        badge.setStyle(Style.EMPTY.withColor(TextColor.fromRgb(module.color.argb() & 0x00FFFFFF)));
        return badge.append(name);
    }
}

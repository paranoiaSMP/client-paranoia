package gg.paranoia.client.title;

import gg.paranoia.client.menu.MenuTheme;

/**
 * La couleur d'accent de l'ecran d'accueil.
 *
 * <p>Seul l'accent change, jamais les fonds ni le texte. C'est delibere: la
 * gamme Nocturne est partagee avec le launcher et verifiee en CI, et la faire
 * varier au gre d'un bouton reconduirait exactement la derive que cette
 * verification existe pour empecher. Un accent, lui, se choisit sans rien
 * casser -- c'est la seule couleur dont la valeur exacte ne veut rien dire
 * ailleurs.
 *
 * <p>{@code AMETHYSTE} est la valeur de {@link MenuTheme#ACCENT}, celle du
 * launcher, et reste le defaut.
 */
public enum Teinte {
    AMETHYSTE("Amethyste", MenuTheme.ACCENT),
    CYAN("Cyan", 0xFF5FB8D9),
    EMERAUDE("Emeraude", 0xFF57C08A),
    AMBRE("Ambre", 0xFFD9A441),
    ROSE("Rose", 0xFFD97BA8);

    private final String label;
    private final int argb;

    Teinte(String label, int argb) {
        this.label = label;
        this.argb = argb;
    }

    public String label() {
        return label;
    }

    public int argb() {
        return argb;
    }

    /** La meme teinte, assez transparente pour servir de fond a un survol. */
    public int voile() {
        return (argb & 0x00FFFFFF) | 0x55000000;
    }
}

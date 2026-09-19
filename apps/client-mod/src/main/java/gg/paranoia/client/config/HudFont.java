package gg.paranoia.client.config;

import net.minecraft.util.Identifier;

/**
 * La police du texte des HUD.
 *
 * <p>Minecraft choisit une police par le style d'un {@code Text}, et non par
 * un {@code TextRenderer} different: le rendu vanilla honore
 * {@code Style.withFont}. Il n'y a donc rien a remplacer dans la chaine de
 * dessin -- seulement un identifiant a poser sur le texte, et le meme a
 * fournir quand on le mesure.
 *
 * <p>C'est aussi la raison pour laquelle {@code fontHeight} n'apparait nulle
 * part ici: la hauteur de ligne reste 9 quelle que soit la police, c'est la
 * grille de Minecraft. Une police qui deborderait de ces neuf pixels serait
 * mal configuree dans son fichier, pas mal appelee.
 */
public enum HudFont {

    /** Celle du jeu. Aucun identifiant: le style par defaut suffit. */
    VANILLA("Minecraft", null),

    /**
     * Silkscreen, police a pixels de huit pixels de haut.
     *
     * <p>Embarquee dans le mod avec sa licence: elle est sous SIL Open Font
     * License, qui autorise la redistribution a condition de joindre le texte
     * de la licence -- {@code assets/paranoia_client/font/silkscreen-OFL.txt}.
     */
    SILKSCREEN("Silkscreen", Identifier.of("paranoia_client", "silkscreen"));

    private final String label;
    private final Identifier id;

    HudFont(String label, Identifier id) {
        this.label = label;
        this.id = id;
    }

    public String label() {
        return label;
    }

    /** {@code null} pour la police du jeu: rien a poser sur le style. */
    public Identifier id() {
        return id;
    }
}

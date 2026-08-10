package gg.paranoia.client.platform;

/**
 * Ce que le code partage ne peut pas ecrire une seule fois.
 *
 * <p>Les sources de {@code src/main/java} sont recompilees dans chaque
 * sous-projet {@code versions/<mc>}, contre le jar Minecraft de cette version:
 * elles peuvent donc manipuler directement {@code DrawContext}, {@code Screen}
 * ou {@code TextRenderer} sans passer par une abstraction. Seul ce qui a change
 * de nom ou de signature entre les versions ciblees passe par ici.
 *
 * <p>Chaque ajout a cette interface est un cout paye deux fois (une fois par
 * version): elle doit rester petite.
 */
public interface ClientPlatform {
    /** Version de Minecraft pour laquelle ce jar a ete compile, ex. "1.21.8". */
    String minecraftVersion();
}

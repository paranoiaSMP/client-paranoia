package gg.paranoia.client.modules;

import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;

/**
 * Laisse le client conclure sa propre bouchee, au lieu d'attendre le serveur.
 *
 * <h2>Le probleme</h2>
 *
 * <p>Le client compte bien les ticks d'une consommation, mais il ne conclut
 * jamais: la sonde de la CI l'a lu dans le bytecode de
 * {@code tickItemStackUsage}, ou l'appel a {@code consumeItem} est garde par
 * {@code !World.isClient()}. Le compteur atteint donc zero et l'usage reste
 * « en cours » jusqu'a ce que le serveur reponde.
 *
 * <p>Et tant qu'un usage est en cours, le joueur ne peut pas agir. C'est la le
 * vrai cout: pas le fait de manger plus lentement -- la duree de la bouchee ne
 * change pas -- mais le fait de rester bloque un aller-retour de ping de plus.
 *
 * <h2>Ce qui est fait, et ce qui ne l'est pas</h2>
 *
 * <p>Le client termine l'usage a l'instant prevu, en appelant lui-meme
 * {@code clearActiveItem}. Rien d'autre.
 *
 * <p><strong>Il ne consomme pas.</strong> La pile, la faim et les effets restent
 * au serveur, qui les applique comme avant. Decrementer la pile en local
 * reviendrait a inventer un etat que personne n'a confirme: on aurait echange un
 * delai visible contre des objets fantomes, ce qui est pire. La regle tient en
 * une phrase -- <em>la decision passe au client, la verite reste au
 * serveur</em> -- et elle est la raison pour laquelle ce module ne peut pas
 * creer de bug d'inventaire.
 *
 * <p>Le serveur applique donc toujours la regeneration d'une pomme d'or, et le
 * client cesse simplement d'attendre sa permission pour baisser le bras.
 */
public final class ConsumableModule extends Module {
    /** Le mixin tourne dans le tick d'une entite: il lui faut un acces direct. */
    private static ConsumableModule instance;

    /**
     * Terminer l'usage au tick prevu.
     *
     * <p>Un reglage et non un comportement impose, parce que c'est la seule
     * facon de repondre a la question « est-ce ce module qui cause ce que je
     * vois ? » sans republier quoi que ce soit.
     */
    private final BooleanSetting finishOnTime =
        add(new BooleanSetting("finish", "Finir a l'instant prevu", true));

    public ConsumableModule() {
        super("consumable", "Consommation", ModuleCategory.COMBAT, true);
        describe("Termine la bouchee au tick prevu, sans attendre le serveur.");
        instance = this;
    }

    public static ConsumableModule instance() {
        return instance;
    }

    /** Le client doit-il conclure l'usage lui-meme ? */
    public boolean finishesOnTime() {
        return enabled() && finishOnTime.get();
    }
}

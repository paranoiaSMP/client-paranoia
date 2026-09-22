package gg.paranoia.client.modules;

import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;

/**
 * Retire le crystal de l'affichage des la frappe, au lieu d'attendre le serveur.
 *
 * <h2>Le probleme</h2>
 *
 * <p>Quand on frappe un end crystal, le serveur le detruit immediatement, mais
 * le client garde l'entite jusqu'a ce que le paquet de suppression lui revienne.
 * Or sa boite de collision occupe encore la place: impossible d'en poser un
 * nouveau au meme endroit. Le joueur attend donc <strong>un aller-retour de ping
 * complet par crystal</strong>, alors que le serveur a deja tout traite. A 80 ms
 * de ping et cinq crystals, c'est presque une demi-seconde perdue sur un burst.
 *
 * <p>Ce n'est pas le reseau qui est en cause, c'est le client qui est plus
 * restrictif que le serveur.
 *
 * <h2>Pourquoi c'est sur, et non un pari</h2>
 *
 * <p>Un end crystal meurt de <em>n'importe quel</em> degat: il n'a pas de points
 * de vie a entamer. Predire sa disparition n'est donc pas une supposition, c'est
 * une certitude -- des lors que le coup atteint le serveur, et le jeu passe par
 * TCP, donc il l'atteint.
 *
 * <p>C'est ce qui distingue ce module d'une prediction de combat ordinaire. On ne
 * devine pas si le coup va tuer: on sait qu'il tue.
 *
 * <h2>Ce que ce module n'est pas</h2>
 *
 * <p>Il ne frappe pas, ne pose pas, ne choisit pas la cible. Il ne donne aucune
 * information que le joueur n'aurait pas -- le crystal qu'il efface est deja
 * detruit. Il enleve une attente que le client s'imposait a lui-meme, comme le
 * font la synchronisation verticale coupee ou la limite d'images preparees en
 * avance, cote launcher.
 *
 * <p>L'auto-crystal, lui, frapperait a la place du joueur. Ce n'est pas la meme
 * chose et ce n'est pas ici.
 *
 * <h2>La desynchronisation, assumee</h2>
 *
 * <p>Si le serveur refuse le coup -- joueur hors de portee au moment ou il le
 * traite -- le crystal existe encore chez lui et plus chez le joueur, qui frappe
 * alors dans le vide jusqu'a ce qu'il sorte et revienne a portee.
 *
 * <p>Ce cas est accepte plutot que corrige, et c'est un choix: restaurer
 * l'entite apres un delai demanderait de deviner ce delai, ferait clignoter le
 * crystal, et corrigerait une frequence qu'on ne connait pas encore. Le module
 * s'eteint d'un clic; on mesurera en jeu avant d'ecrire du code contre une peur.
 */
public final class CrystalCleanupModule extends Module {
    /** Le mixin tourne dans le chemin d'attaque: il lui faut un acces direct. */
    private static CrystalCleanupModule instance;

    public CrystalCleanupModule() {
        super("crystalcleanup", "Crystal instantane", ModuleCategory.COMBAT, true);
        describe("Efface le crystal frappe sans attendre le serveur.");
        instance = this;
    }

    public static CrystalCleanupModule instance() {
        return instance;
    }
}

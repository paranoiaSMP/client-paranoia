package gg.paranoia.client.module;

import com.google.gson.JsonElement;
import com.google.gson.JsonPrimitive;
import org.lwjgl.glfw.GLFW;

/**
 * Une touche du clavier, choisie en appuyant dessus.
 *
 * <p>La capture se fait en interrogeant GLFW, pas en interceptant l'evenement
 * clavier de l'ecran. C'est deliberement le chemin le plus simple: la signature
 * de {@code Screen.keyPressed} a change entre les versions ciblees -- trois
 * entiers d'un cote, un objet {@code KeyInput} de l'autre -- alors que GLFW est
 * identique partout, et que le mod lit deja sa touche d'ouverture comme ca.
 * Aucun code par version, aucune API nouvelle.
 *
 * <p>Le balayage ne tourne que pendant la capture, c'est-a-dire quelques
 * secondes dans la vie du jeu, et il s'arrete a la premiere touche trouvee.
 */
public final class KeySetting extends Setting<Integer> {
    /**
     * La capture en cours, s'il y en a une.
     *
     * <p>Une seule a la fois: deux champs en attente se disputeraient la meme
     * frappe. Ouvrir une capture ferme la precedente.
     */
    private static KeySetting capturing;

    /** Aucune touche: le raccourci existe mais n'est lie a rien. */
    public static final int NONE = -1;

    public KeySetting(String id, String label, int defaultKey) {
        super(id, label, defaultKey);
    }

    public int get() {
        return value;
    }

    public static boolean isCapturing() {
        return capturing != null;
    }

    public boolean waiting() {
        return capturing == this;
    }

    /** Demarre l'attente d'une frappe, en annulant celle d'un autre champ. */
    public void beginCapture() {
        capturing = this;
    }

    public static void cancelCapture() {
        capturing = null;
    }

    /**
     * Cherche une touche enfoncee et l'affecte au champ en attente.
     *
     * <p>A appeler a chaque tick. Sans capture en cours, ne fait rien -- c'est
     * le cas de tous les ticks sauf une poignee.
     *
     * @param window le handle GLFW de la fenetre du jeu.
     */
    public static void tick(long window) {
        KeySetting target = capturing;
        if (target == null) {
            return;
        }

        // Echap annule sans rien lier: c'est la sortie attendue quand on ouvre
        // la capture par erreur.
        if (GLFW.glfwGetKey(window, GLFW.GLFW_KEY_ESCAPE) == GLFW.GLFW_PRESS) {
            capturing = null;
            return;
        }

        // Retour arriere delie la touche. Sans cela, une capture ouverte ne
        // pourrait se refermer qu'en liant quelque chose.
        if (GLFW.glfwGetKey(window, GLFW.GLFW_KEY_BACKSPACE) == GLFW.GLFW_PRESS) {
            target.value = NONE;
            capturing = null;
            return;
        }

        // GLFW numerote ses touches de l'espace au dernier modificateur. On
        // parcourt la plage entiere: n'importe quelle touche convient, y compris
        // celles qui n'existent pas sur un clavier francais.
        for (int code = GLFW.GLFW_KEY_SPACE; code <= GLFW.GLFW_KEY_LAST; code++) {
            if (GLFW.glfwGetKey(window, code) == GLFW.GLFW_PRESS) {
                target.value = code;
                capturing = null;
                return;
            }
        }
    }

    /** Nom lisible de la touche liee, ou l'invite pendant la capture. */
    public String display() {
        if (waiting()) {
            return "Appuyez...";
        }
        return nameOf(value);
    }

    /**
     * Nom d'une touche.
     *
     * <p>GLFW sait nommer les touches imprimables -- et le fait selon la
     * disposition du clavier, ce qui donne « A » sur un AZERTY la ou un QWERTY
     * dirait « Q ». Les autres n'ont pas de nom et sont listees ici.
     */
    public static String nameOf(int code) {
        if (code == NONE) {
            return "Aucune";
        }

        String named = special(code);
        if (named != null) {
            return named;
        }

        String printable = GLFW.glfwGetKeyName(code, 0);
        if (printable != null && !printable.isBlank()) {
            return printable.toUpperCase();
        }
        return "Touche " + code;
    }

    private static String special(int code) {
        return switch (code) {
            case GLFW.GLFW_KEY_SPACE -> "Espace";
            case GLFW.GLFW_KEY_ENTER -> "Entree";
            case GLFW.GLFW_KEY_TAB -> "Tab";
            case GLFW.GLFW_KEY_BACKSPACE -> "Retour";
            case GLFW.GLFW_KEY_INSERT -> "Inser";
            case GLFW.GLFW_KEY_DELETE -> "Suppr";
            case GLFW.GLFW_KEY_RIGHT -> "Droite";
            case GLFW.GLFW_KEY_LEFT -> "Gauche";
            case GLFW.GLFW_KEY_DOWN -> "Bas";
            case GLFW.GLFW_KEY_UP -> "Haut";
            case GLFW.GLFW_KEY_PAGE_UP -> "Page haut";
            case GLFW.GLFW_KEY_PAGE_DOWN -> "Page bas";
            case GLFW.GLFW_KEY_HOME -> "Origine";
            case GLFW.GLFW_KEY_END -> "Fin";
            case GLFW.GLFW_KEY_CAPS_LOCK -> "Verr Maj";
            case GLFW.GLFW_KEY_LEFT_SHIFT -> "Maj gauche";
            case GLFW.GLFW_KEY_RIGHT_SHIFT -> "Maj droite";
            case GLFW.GLFW_KEY_LEFT_CONTROL -> "Ctrl gauche";
            case GLFW.GLFW_KEY_RIGHT_CONTROL -> "Ctrl droit";
            case GLFW.GLFW_KEY_LEFT_ALT -> "Alt gauche";
            case GLFW.GLFW_KEY_RIGHT_ALT -> "Alt droit";
            default -> code >= GLFW.GLFW_KEY_F1 && code <= GLFW.GLFW_KEY_F25
                ? "F" + (code - GLFW.GLFW_KEY_F1 + 1)
                : null;
        };
    }

    @Override
    public JsonElement toJson() {
        return new JsonPrimitive(value);
    }

    @Override
    public void fromJson(JsonElement json) {
        if (json == null || !json.isJsonPrimitive()) {
            return;
        }
        try {
            value = json.getAsInt();
        } catch (NumberFormatException ignored) {
            // Fichier abime: on garde le defaut plutot qu'une touche absurde.
        }
    }
}

package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;

/** Position du joueur, avec les coordonnees du Nether en option. */
public final class CoordinatesHud extends HudElement {
    private final BooleanSetting showNether =
        add(new BooleanSetting("nether", "Coordonnees Nether", false));
    private final BooleanSetting compact =
        add(new BooleanSetting("compact", "Affichage compact", true));
    private final ColorSetting color =
        add(new ColorSetting("color", "Couleur du texte", 0xFFFFFFFF));

    // Contenu de l'image en cours, et les valeurs dont il decoule. Un joueur
    // qui marche change de bloc vingt fois par seconde au plus, alors que le
    // jeu dessine dix fois plus souvent: le cas courant est celui ou rien n'a
    // bouge depuis l'image precedente.
    private String[] lines = {"0 / 64 / 0"};
    private int lastX = Integer.MIN_VALUE;
    private int lastY = Integer.MIN_VALUE;
    private int lastZ = Integer.MIN_VALUE;
    private boolean lastCompact;
    private boolean lastNether;
    private boolean lastHadPlayer;

    public CoordinatesHud() {
        super("coordinates", "Coordonnees", true);
        describe("Position XYZ, masquable en enregistrement.");
        placeAt(0.01, 0.02);
    }

    @Override
    public boolean visibleInGame() {
        return client() != null && client().player != null;
    }

    @Override
    protected void refresh() {
        ClientPlayerEntity player = client() == null ? null : client().player;

        boolean hasPlayer = player != null;
        boolean compactNow = compact.get();
        boolean netherNow = showNether.get();

        // Le menu peut s'ouvrir depuis l'ecran titre: on montre un exemple
        // plutot qu'un cadre vide impossible a positionner.
        int x = hasPlayer ? (int) Math.floor(player.getX()) : 0;
        int y = hasPlayer ? (int) Math.floor(player.getY()) : 64;
        int z = hasPlayer ? (int) Math.floor(player.getZ()) : 0;

        if (hasPlayer == lastHadPlayer
            && x == lastX && y == lastY && z == lastZ
            && compactNow == lastCompact && netherNow == lastNether) {
            return;
        }

        lastHadPlayer = hasPlayer;
        lastX = x;
        lastY = y;
        lastZ = z;
        lastCompact = compactNow;
        lastNether = netherNow;

        if (compactNow) {
            String main = x + " / " + y + " / " + z;
            lines = netherNow
                ? new String[] {main, "Nether " + (x / 8) + " / " + (z / 8)}
                : new String[] {main};
            return;
        }

        lines = netherNow
            ? new String[] {"X " + x, "Y " + y, "Z " + z, "Nether " + (x / 8) + " / " + (z / 8)}
            : new String[] {"X " + x, "Y " + y, "Z " + z};
    }

    /**
     * L'ecart entre le libelle d'axe et sa valeur.
     *
     * <p>La maquette pose « XYZ » a gauche et la valeur a droite, separes par
     * le vide plutot que par un signe. Le libelle ne bouge pas quand la valeur
     * s'allonge -- ce qui arrive des qu'on passe sous zero.
     */
    private static final int LABEL_GAP = 10;

    /** Le libelle de la ligne: « XYZ » en compact, l'axe sinon. */
    private String labelOf(int index) {
        if (lastCompact) {
            return index == 0 ? "XYZ" : "NETHER";
        }
        return switch (index) {
            case 0 -> "X";
            case 1 -> "Y";
            case 2 -> "Z";
            default -> "NETHER";
        };
    }

    /** La valeur seule, le libelle d'axe retire du texte prepare. */
    private String valueOf(int index) {
        String line = lines[index];
        String prefix = labelOf(index) + " ";
        return line.regionMatches(true, 0, prefix, 0, prefix.length())
            ? line.substring(prefix.length())
            : line;
    }

    private int labelColumn(TextRenderer textRenderer) {
        int widest = 0;
        for (int i = 0; i < lines.length; i++) {
            widest = Math.max(widest, kickerWidth(textRenderer, labelOf(i)));
        }
        return widest;
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int widest = 0;
        for (int i = 0; i < lines.length; i++) {
            widest = Math.max(widest, measure(textRenderer, valueOf(i)));
        }
        return labelColumn(textRenderer) + LABEL_GAP + widest + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return lines.length * (textRenderer.fontHeight + 1) - 1 + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        int column = labelColumn(textRenderer);
        for (int i = 0; i < lines.length; i++) {
            int lineY = y + i * (textRenderer.fontHeight + 1);
            drawKicker(context, textRenderer, labelOf(i), x, lineY, 0x9397AB);
            drawLine(context, textRenderer, valueOf(i), x + column + LABEL_GAP, lineY, color.argb());
        }
    }
}

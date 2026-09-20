package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

import java.util.Arrays;

/**
 * Images par seconde, le chiffre principal du HUD.
 *
 * <p>La valeur vient de {@code MinecraftClient.getCurrentFps()}, dont la sonde
 * en CI confirme la signature identique sur les versions ciblees: c'est le
 * meme compteur que celui de l'ecran F3, pas une mesure maison qui divergerait
 * de ce que le joueur voit ailleurs.
 *
 * <p>La carte reprend celle de la maquette: le chiffre en grand, son unite en
 * kicker a cote, le 1 % low a droite, et un graphe des trente dernieres
 * secondes dessous. Ce qui etait affiche avant -- « 412 FPS » sur une ligne --
 * disait la meme chose, mais ne disait rien de la stabilite, qui est
 * precisement ce qu'on regarde quand on regarde ses FPS.
 */
public final class FpsHud extends HudElement {
    /** Une barre par seconde, comme la maquette. */
    private static final int HISTORY = 26;

    private static final int SPARK_HEIGHT = 12;
    private static final int SPARK_GAP = 1;

    /**
     * Combien de durees d'image on garde pour le 1 % low.
     *
     * <p>Mille vingt-quatre couvre quatre secondes a deux cent cinquante images
     * par seconde, et une minute a dix-sept. Le centile se calcule une fois par
     * seconde, pas a chaque image: trier mille valeurs deux cent quarante fois
     * par seconde couterait plus cher que tout le reste du HUD reuni.
     */
    private static final int FRAME_SAMPLES = 1024;

    private final BooleanSetting showLow =
        add(new BooleanSetting("low", "Afficher le 1 % low", true));
    private final BooleanSetting showGraph =
        add(new BooleanSetting("graph", "Afficher le graphe", true));
    private final ColorSetting color = add(new ColorSetting("color", "Couleur", 0xFFE9E9ED));

    public FpsHud() {
        super("fps", "FPS", false);
        describe("Images par seconde, 1 % low et graphe sur trente secondes.");
        placeAt(0.01, 0.16);
    }

    // Le compteur du jeu ne bouge qu'une fois par seconde: formater ce nombre a
    // chaque image reviendrait a jeter deux cent trente-neuf chaines sur deux
    // cent quarante, toutes identiques.
    private String value = "0";
    private String low = "";
    private int lastFps = Integer.MIN_VALUE;
    private int lastLow = Integer.MIN_VALUE;

    /** Historique par seconde, en anneau: pas de decalage de tableau. */
    private final int[] history = new int[HISTORY];
    private int historyAt;
    private int historyFilled;
    private int peak = 1;

    private final long[] frames = new long[FRAME_SAMPLES];
    private int framesAt;
    private int framesFilled;
    private long lastFrameNanos;
    private long lastSecond;

    @Override
    protected void refresh() {
        MinecraftClient client = client();
        int fps = client == null ? 0 : client.getCurrentFps();

        sampleFrame();

        long now = System.currentTimeMillis();
        if (now - lastSecond >= 1000) {
            lastSecond = now;
            history[historyAt] = fps;
            historyAt = (historyAt + 1) % HISTORY;
            historyFilled = Math.min(historyFilled + 1, HISTORY);
            peak = Math.max(1, Arrays.stream(history).max().orElse(1));
            lastLow = onePercentLow();
            low = lastLow > 0 ? "1 % LOW " + lastLow : "";
        }

        if (fps != lastFps) {
            lastFps = fps;
            value = String.valueOf(fps);
        }
    }

    /** La duree de l'image qui vient de s'ecouler, en nanosecondes. */
    private void sampleFrame() {
        long now = System.nanoTime();
        if (lastFrameNanos != 0) {
            long delta = now - lastFrameNanos;
            // Une image de plus d'une seconde n'est pas une image: c'est un
            // chargement, une pause, ou la fenetre qui revient au premier plan.
            // La compter ecraserait le centile pour la minute suivante.
            if (delta > 0 && delta < 1_000_000_000L) {
                frames[framesAt] = delta;
                framesAt = (framesAt + 1) % FRAME_SAMPLES;
                framesFilled = Math.min(framesFilled + 1, FRAME_SAMPLES);
            }
        }
        lastFrameNanos = now;
    }

    /**
     * Le centile 99 des durees d'image, rendu en images par seconde.
     *
     * <p>C'est bien le 1 % low et non le minimum: le minimum serait la pire
     * image de la fenetre entiere, donc n'importe quel a-coup isole -- une
     * valeur qui saute et ne dit rien. Le centile ecarte ces accidents et
     * garde ce qui se repete.
     */
    private int onePercentLow() {
        if (framesFilled < 32) {
            return 0;
        }
        long[] tri = Arrays.copyOf(frames, framesFilled);
        Arrays.sort(tri);
        long pire = tri[(int) Math.min(framesFilled - 1L, Math.round(framesFilled * 0.99))];
        return pire <= 0 ? 0 : (int) (1_000_000_000L / pire);
    }

    private boolean graphVisible() {
        return showGraph.get() && historyFilled > 1;
    }

    /** Le kicker « FPS » suit le chiffre, le 1 % low se pose a droite. */
    private int headerWidth(TextRenderer textRenderer) {
        int total = heroWidth(textRenderer, value) + 4 + kickerWidth(textRenderer, "FPS");
        if (showLow.get() && !low.isEmpty()) {
            total += 8 + kickerWidth(textRenderer, low);
        }
        return total;
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int content = headerWidth(textRenderer);
        if (graphVisible()) {
            content = Math.max(content, HISTORY * (1 + SPARK_GAP) - SPARK_GAP);
        }
        return content + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        int content = heroHeight(textRenderer);
        if (graphVisible()) {
            content += 4 + SPARK_HEIGHT;
        }
        return content + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        drawHero(context, textRenderer, value, x, y, color.argb());

        // Le kicker s'aligne sur le bas du chiffre, pas sur son haut: c'est ce
        // qui les fait lire comme une seule unite plutot que deux etages.
        int hero = heroHeight(textRenderer);
        int kickerY = y + hero - textRenderer.fontHeight;
        int kickerX = x + heroWidth(textRenderer, value) + 4;
        drawKicker(context, textRenderer, "FPS", kickerX, kickerY, 0x9397AB);

        if (showLow.get() && !low.isEmpty()) {
            int lowX = x + width(textRenderer) - PADDING * 2 - kickerWidth(textRenderer, low);
            drawKicker(context, textRenderer, low, Math.max(kickerX + kickerWidth(textRenderer, "FPS") + 8, lowX),
                kickerY, 0xB5ABFC);
        }

        if (graphVisible()) {
            drawSpark(context, x, y + hero + 4, width(textRenderer) - PADDING * 2);
        }
    }

    /**
     * Le graphe des dernieres secondes.
     *
     * <p>Les quatre dernieres barres sont plus claires, comme dans la maquette:
     * c'est ce qui distingue ce qui vient de se passer de ce qui s'est passe.
     * L'echelle est relative au sommet de la fenetre, sinon un joueur a trois
     * cents images par seconde ne verrait qu'une ligne plate.
     */
    private void drawSpark(DrawContext context, int x, int y, int available) {
        int barres = Math.min(HISTORY, historyFilled);
        int largeur = Math.max(1, (available - (barres - 1) * SPARK_GAP) / barres);

        for (int index = 0; index < barres; index++) {
            // On lit l'anneau du plus ancien au plus recent.
            int slot = (historyAt - barres + index + HISTORY * 2) % HISTORY;
            int hauteur = Math.max(1, history[slot] * SPARK_HEIGHT / peak);
            int barX = x + index * (largeur + SPARK_GAP);
            int barY = y + SPARK_HEIGHT - hauteur;
            boolean recente = index >= barres - 4;
            context.fill(barX, barY, barX + largeur, y + SPARK_HEIGHT,
                textColor(recente ? 0xB5ABFC : 0x796CBF));
        }
    }
}

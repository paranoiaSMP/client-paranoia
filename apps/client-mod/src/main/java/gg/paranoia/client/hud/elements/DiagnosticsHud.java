package gg.paranoia.client.hud.elements;

import gg.paranoia.client.cosmetics.CosmeticTextures;
import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import gg.paranoia.client.modules.EntityCullingModule;
import gg.paranoia.client.modules.ParticleBudgetModule;
import gg.paranoia.client.net.ParanoiaApi;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

import java.util.ArrayList;
import java.util.List;

/**
 * Ce que le client fait reellement, en chiffres.
 *
 * <p>Ce panneau existe parce que toutes les optimisations du mod sont, sans
 * lui, des affirmations. « Les textures sont partagees », « les rafales de
 * particules sont ecretees », « on ne redemande plus a l'API ce qui n'a pas
 * bouge »: rien de tout cela ne se voit a l'ecran, et un reglage qui ne se
 * verifie pas est un reglage auquel on finit par ne plus croire.
 *
 * <p>Chaque ligne repond a une question qu'on se pose vraiment:
 *
 * <ul>
 *   <li><strong>Textures</strong> -- trente joueurs portant la meme cape
 *       doivent en afficher une, pas trente;
 *   <li><strong>Particules</strong> -- combien la rafale en a-t-elle
 *       reellement coute, et le plafond mord-il quand il faut;
 *   <li><strong>Entites</strong> -- l'allegement du decor travaille-t-il, ou
 *       le reglage est-il simplement trop large pour mordre;
 *   <li><strong>Requetes</strong> -- un total qui grimpe lentement confirme
 *       que l'interrogation est bien sautee quand personne ne bouge;
 *   <li><strong>Memoire</strong> -- la seule qui ne concerne pas le mod, mais
 *       celle qu'on regarde en premier quand le jeu saccade.
 * </ul>
 *
 * <p>Desactive par defaut: c'est un instrument, pas un ornement.
 */
public final class DiagnosticsHud extends HudElement {
    private final BooleanSetting showCosmetics =
        add(new BooleanSetting("cosmetics", "Textures et requetes", true));
    private final BooleanSetting showCulling =
        add(new BooleanSetting("culling", "Particules et entites ecartees", true));
    private final BooleanSetting showMemory =
        add(new BooleanSetting("memory", "Memoire du tas", true));
    private final ColorSetting labelColor =
        add(new ColorSetting("labelColor", "Couleur des libelles", 0xFF9090A0));
    private final ColorSetting valueColor =
        add(new ColorSetting("valueColor", "Couleur des valeurs", 0xFF7CFF9E));

    public DiagnosticsHud() {
        super("diagnostics", "Diagnostic Paranoia", false);
        placeAt(0.99, 0.35);
    }

    /** Une ligne, reutilisee d'une image a l'autre. */
    private static final class Line {
        String label = "";
        String value = "";
    }

    private final List<Line> pool = new ArrayList<>();
    private int count;

    // Chaque valeur n'est reformatee que lorsque son chiffre change: le panneau
    // qui mesure le gaspillage serait mal venu d'en produire.
    private String texturesText = "0";
    private String requestsText = "0";
    private String particlesText = "0/s";
    private String entitiesText = "0/s";
    private String memoryText = "0 Mo";

    private int lastTextures = Integer.MIN_VALUE;
    private int lastRequests = Integer.MIN_VALUE;
    private int lastParticles = Integer.MIN_VALUE;
    private int lastEntities = Integer.MIN_VALUE;
    private int lastMemory = Integer.MIN_VALUE;

    @Override
    public boolean visibleInGame() {
        return count > 0;
    }

    @Override
    protected void refresh() {
        count = 0;

        if (showCosmetics.get()) {
            int textures = CosmeticTextures.liveCount();
            if (textures != lastTextures) {
                lastTextures = textures;
                texturesText = String.valueOf(textures);
            }
            add("Textures", texturesText);

            int requests = ParanoiaApi.requestCount();
            if (requests != lastRequests) {
                lastRequests = requests;
                requestsText = String.valueOf(requests);
            }
            add("Requetes", requestsText);
        }

        if (showCulling.get()) {
            int particles = ParticleBudgetModule.droppedPerSecond();
            if (particles != lastParticles) {
                lastParticles = particles;
                particlesText = particles + "/s";
            }
            add("Particules ecartees", particlesText);

            int entities = EntityCullingModule.skippedPerSecond();
            if (entities != lastEntities) {
                lastEntities = entities;
                entitiesText = entities + "/s";
            }
            add("Entites ecartees", entitiesText);
        }

        if (showMemory.get()) {
            Runtime runtime = Runtime.getRuntime();
            // En mega-octets: l'octet pres n'apprend rien, et un chiffre qui
            // change a chaque image ne se lit pas.
            int used = (int) ((runtime.totalMemory() - runtime.freeMemory()) >> 20);
            if (used != lastMemory) {
                lastMemory = used;
                memoryText = used + " Mo";
            }
            add("Memoire", memoryText);
        }
    }

    private void add(String label, String value) {
        while (pool.size() <= count) {
            pool.add(new Line());
        }
        Line line = pool.get(count++);
        line.label = label;
        line.value = value;
    }

    private int labelWidth(TextRenderer textRenderer) {
        int widest = 0;
        for (int index = 0; index < count; index++) {
            widest = Math.max(widest, textRenderer.getWidth(pool.get(index).label));
        }
        return widest;
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int widest = 0;
        int labels = labelWidth(textRenderer);
        for (int index = 0; index < count; index++) {
            widest = Math.max(widest, labels + 6 + textRenderer.getWidth(pool.get(index).value));
        }
        return widest + PADDING * 2;
    }

    @Override
    public int height(TextRenderer textRenderer) {
        return Math.max(1, count) * textRenderer.fontHeight + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        int labels = labelWidth(textRenderer);

        for (int index = 0; index < count; index++) {
            Line line = pool.get(index);
            int lineY = y + index * textRenderer.fontHeight;
            drawLine(context, textRenderer, line.label, x, lineY, labelColor.argb());
            drawLine(context, textRenderer, line.value, x + labels + 6, lineY, valueColor.argb());
        }
    }
}

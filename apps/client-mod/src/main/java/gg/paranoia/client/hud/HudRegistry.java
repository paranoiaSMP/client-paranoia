package gg.paranoia.client.hud;

import gg.paranoia.client.config.ParanoiaConfig;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.platform.Platforms;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Registre des modules, et rendu des HUD en jeu. */
public final class HudRegistry {
    private final Map<String, Module> modules = new LinkedHashMap<>();

    // Les modules s'enregistrent au demarrage et plus jamais ensuite. Ces deux
    // vues sont donc construites une fois: `hudElements()` est parcourue a
    // chaque image, et l'editeur l'appelle plusieurs fois par image.
    private List<Module> allView;
    private List<HudElement> hudView;

    public void register(Module module) {
        if (modules.putIfAbsent(module.id(), module) != null) {
            throw new IllegalStateException("module deja enregistre: " + module.id());
        }
        allView = null;
        hudView = null;
    }

    public List<Module> all() {
        if (allView == null) {
            allView = List.copyOf(modules.values());
        }
        return allView;
    }

    public List<HudElement> hudElements() {
        if (hudView == null) {
            List<HudElement> elements = new ArrayList<>();
            for (Module module : modules.values()) {
                if (module instanceof HudElement hud) {
                    elements.add(hud);
                }
            }
            hudView = Collections.unmodifiableList(elements);
        }
        return hudView;
    }

    public void load() {
        ParanoiaConfig.load(all());
    }

    public void save() {
        ParanoiaConfig.save(all());
    }

    /** Rendu en jeu: seuls les elements actifs et pertinents sont dessines. */
    public void renderInGame(DrawContext context) {
        MinecraftClient client = MinecraftClient.getInstance();
        if (client == null || client.options == null) {
            return;
        }

        // Le menu du jeu, l'ecran de chat ou un ecran quelconque doivent laisser
        // les HUD visibles, mais pas l'ecran de debug F3 ni le masquage d'ATH.
        if (client.options.hudHidden) {
            return;
        }

        TextRenderer textRenderer = client.textRenderer;
        if (textRenderer == null) {
            return;
        }

        int screenWidth = client.getWindow().getScaledWidth();
        int screenHeight = client.getWindow().getScaledHeight();

        HudElement.beginFrame();

        for (HudElement element : hudElements()) {
            if (!element.enabled()) {
                continue;
            }
            // Avant `visibleInGame()`: certains elements repondent en lisant
            // leur contenu, qui doit donc etre celui de cette image.
            element.prepare();
            if (!element.visibleInGame()) {
                continue;
            }
            draw(context, textRenderer, element, screenWidth, screenHeight);
        }
    }

    /**
     * Dessine un element a sa place, mise a l'echelle comprise.
     *
     * <p>Partage avec le menu: en mode edition, les HUD doivent apparaitre
     * exactement comme en jeu, sinon on ne place pas ce qu'on croit placer.
     */
    public static void draw(
        DrawContext context, TextRenderer textRenderer, HudElement element, int screenWidth, int screenHeight) {
        element.prepare();
        float scale = element.layout().scale();

        // Les positions sont calculees dans l'espace mis a l'echelle: sinon un
        // element a 2x se retrouve deux fois plus loin du bord qu'il ne devrait.
        int scaledWidth = (int) (screenWidth / scale);
        int scaledHeight = (int) (screenHeight / scale);
        int x = element.layout().x(scaledWidth, element.width(textRenderer));
        int y = element.layout().y(scaledHeight, element.height(textRenderer));

        if (scale == 1.0f) {
            element.render(context, textRenderer, x, y);
            return;
        }

        Platforms.get().pushScale(context, scale, 0, 0);
        try {
            element.render(context, textRenderer, x, y);
        } finally {
            Platforms.get().popScale(context);
        }
    }

    /** Rectangle occupe a l'ecran, en pixels reels: sert au glisser-deposer. */
    public static int[] bounds(
        HudElement element, TextRenderer textRenderer, int screenWidth, int screenHeight) {
        // L'editeur mesure avant de dessiner, et re-mesure a chaque element
        // pendant l'aimantation: c'est le premier appel de l'image qui prepare,
        // les suivants relisent le meme instantane.
        element.prepare();
        float scale = element.layout().scale();
        int scaledWidth = (int) (screenWidth / scale);
        int scaledHeight = (int) (screenHeight / scale);

        int width = element.width(textRenderer);
        int height = element.height(textRenderer);
        int x = element.layout().x(scaledWidth, width);
        int y = element.layout().y(scaledHeight, height);

        return new int[] {
            Math.round(x * scale), Math.round(y * scale),
            Math.round(width * scale), Math.round(height * scale),
        };
    }
}

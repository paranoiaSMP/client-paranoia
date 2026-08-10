package gg.paranoia.client.menu;

import gg.paranoia.client.config.BackgroundStyle;
import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.hud.HudRegistry;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import gg.paranoia.client.module.EnumSetting;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import gg.paranoia.client.module.Setting;
import gg.paranoia.client.module.SliderSetting;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

import java.util.ArrayList;
import java.util.List;

/**
 * Le mod menu: fond du jeu floute, HUD dessines par-dessus et deplacables a la
 * souris, panneau de reglages a gauche.
 *
 * <p>Le dessin se limite volontairement a {@code fill} et {@code drawText}: ce
 * sont les deux primitives dont la signature n'a pas bouge entre les versions
 * ciblees. Le flou et la mise a l'echelle, eux, passent par la plateforme.
 */
public final class MenuController {
    private static final int PANEL_X = 12;
    private static final int PANEL_Y = 12;
    private static final int PANEL_WIDTH = 168;
    private static final int ROW_HEIGHT = 18;
    private static final int SETTINGS_WIDTH = 190;

    /** Distance en pixels sous laquelle un bord s'aimante. */
    private static final int SNAP_DISTANCE = 5;

    private static final int COLOR_PANEL = 0xE0101014;
    private static final int COLOR_PANEL_BORDER = 0x40FFFFFF;
    private static final int COLOR_ROW_HOVER = 0x30FFFFFF;
    private static final int COLOR_ROW_ACTIVE = 0x40D0A0FF;
    private static final int COLOR_ACCENT = 0xFFB07CFF;
    private static final int COLOR_TEXT = 0xFFE8E8F0;
    private static final int COLOR_TEXT_DIM = 0xFF9090A0;
    private static final int COLOR_GUIDE = 0xFFB07CFF;
    private static final int COLOR_SELECTION = 0xFFB07CFF;

    private final HudRegistry registry;

    private ModuleCategory activeCategory = ModuleCategory.HUD;
    private Module selectedModule;

    private HudElement dragged;
    private int dragGrabX;
    private int dragGrabY;

    // Reperes d'alignement affiches pendant un deplacement.
    private final List<Integer> guidesX = new ArrayList<>();
    private final List<Integer> guidesY = new ArrayList<>();

    // Dimensions et police de l'ecran hote, rafraichies a chaque image.
    private int width;
    private int height;
    private TextRenderer textRenderer;

    // Derniere position connue du curseur, relevee au rendu.
    //
    // On ne lit pas la position portee par l'evenement souris: en 1.21.11 un
    // clic arrive dans un objet Click qui porte le point d'appui, pas le point
    // courant, ce qui ferait sauter tout deplacement. Le rendu, lui, recoit la
    // position courante avec la meme signature sur les deux versions.
    private int mouseX;
    private int mouseY;

    public MenuController(HudRegistry registry) {
        this.registry = registry;
    }

    /** Appele par l'ecran de la version avant tout rendu ou toute entree. */
    public void setViewport(int width, int height, TextRenderer textRenderer) {
        this.width = width;
        this.height = height;
        this.textRenderer = textRenderer;
    }

    /**
     * Fermer le menu vaut validation: le joueur ne devrait pas avoir a penser a
     * enregistrer ce qu'il vient de deplacer.
     */
    public void onClosed() {
        registry.save();
    }

    // ------------------------------------------------------------------ rendu

    public void render(DrawContext context, int mouseX, int mouseY) {
        this.mouseX = mouseX;
        this.mouseY = mouseY;

        // Le deplacement suit le curseur image par image plutot que les
        // evenements de glissement, dont la forme differe selon la version.
        if (dragged != null) {
            updateDrag();
        }

        renderHudElements(context);
        renderGuides(context);
        renderPanel(context, mouseX, mouseY);

        if (selectedModule != null) {
            renderSettingsPanel(context, mouseX, mouseY);
        }
    }

    /** Les HUD tels qu'ils apparaitront en jeu, plus un cadre en mode edition. */
    private void renderHudElements(DrawContext context) {
        for (HudElement element : registry.hudElements()) {
            if (!element.enabledByPlayer()) {
                continue;
            }

            HudRegistry.draw(context, textRenderer, element, width, height);

            int[] box = HudRegistry.bounds(element, textRenderer, width, height);
            boolean active = element == dragged || element == selectedModule;
            drawOutline(context, box[0], box[1], box[2], box[3], active ? COLOR_SELECTION : 0x40FFFFFF);
        }
    }

    private void renderGuides(DrawContext context) {
        for (int x : guidesX) {
            context.fill(x, 0, x + 1, height, COLOR_GUIDE);
        }
        for (int y : guidesY) {
            context.fill(0, y, width, y + 1, COLOR_GUIDE);
        }
    }

    private List<Module> visibleModules() {
        List<Module> visible = new ArrayList<>();
        for (Module module : registry.all()) {
            if (module.category() == activeCategory) {
                visible.add(module);
            }
        }
        return visible;
    }

    private int panelHeight() {
        return 30 + ModuleCategory.values().length * ROW_HEIGHT + 10
            + Math.max(1, visibleModules().size()) * ROW_HEIGHT + 10;
    }

    private void renderPanel(DrawContext context, int mouseX, int mouseY) {
        int panelHeight = panelHeight();
        fillPanel(context, PANEL_X, PANEL_Y, PANEL_WIDTH, panelHeight);

        context.drawText(textRenderer, "PARANOIA", PANEL_X + 10, PANEL_Y + 10, COLOR_ACCENT, false);
        context.drawText(
            textRenderer, "Maj droite pour fermer", PANEL_X + 10, PANEL_Y + 20, COLOR_TEXT_DIM, false);

        int y = PANEL_Y + 34;
        for (ModuleCategory category : ModuleCategory.values()) {
            boolean active = category == activeCategory;
            boolean hovered = inside(mouseX, mouseY, PANEL_X + 6, y, PANEL_WIDTH - 12, ROW_HEIGHT);
            if (active || hovered) {
                context.fill(
                    PANEL_X + 6, y, PANEL_X + PANEL_WIDTH - 6, y + ROW_HEIGHT,
                    active ? COLOR_ROW_ACTIVE : COLOR_ROW_HOVER);
            }
            context.drawText(
                textRenderer, category.label(), PANEL_X + 12, y + 5, active ? COLOR_ACCENT : COLOR_TEXT, false);
            y += ROW_HEIGHT;
        }

        y += 8;
        List<Module> modules = visibleModules();
        if (modules.isEmpty()) {
            context.drawText(textRenderer, "Rien ici pour l'instant", PANEL_X + 12, y + 5, COLOR_TEXT_DIM, false);
            return;
        }

        for (Module module : modules) {
            boolean hovered = inside(mouseX, mouseY, PANEL_X + 6, y, PANEL_WIDTH - 12, ROW_HEIGHT);
            if (module == selectedModule || hovered) {
                context.fill(
                    PANEL_X + 6, y, PANEL_X + PANEL_WIDTH - 6, y + ROW_HEIGHT,
                    module == selectedModule ? COLOR_ROW_ACTIVE : COLOR_ROW_HOVER);
            }

            int labelColor = module.lockedByServer() ? COLOR_TEXT_DIM : COLOR_TEXT;
            context.drawText(textRenderer, module.name(), PANEL_X + 12, y + 5, labelColor, false);

            drawToggle(context, PANEL_X + PANEL_WIDTH - 32, y + 4, module);

            if (module.lockedByServer()) {
                // Dit pourquoi l'interrupteur ne repond pas, plutot que de
                // laisser croire a un bug.
                context.drawText(
                    textRenderer, "serveur", PANEL_X + PANEL_WIDTH - 76, y + 5, COLOR_TEXT_DIM, false);
            }

            y += ROW_HEIGHT;
        }
    }

    private void drawToggle(DrawContext context, int x, int y, Module module) {
        boolean on = module.enabledByPlayer() && !module.lockedByServer();
        int track = on ? 0xFF6B4A9E : 0x50FFFFFF;
        context.fill(x, y, x + 20, y + 10, track);
        int knobX = on ? x + 11 : x + 1;
        context.fill(knobX, y + 1, knobX + 8, y + 9, on ? COLOR_ACCENT : 0xFFB0B0C0);
    }

    private void renderSettingsPanel(DrawContext context, int mouseX, int mouseY) {
        int x = PANEL_X + PANEL_WIDTH + 10;
        int y = PANEL_Y;
        List<Setting<?>> settings = selectedModule.settings();
        boolean isHud = selectedModule instanceof HudElement;

        int rows = settings.size() + (isHud ? 4 : 0);
        int panelHeight = 30 + Math.max(1, rows) * ROW_HEIGHT + 10;
        fillPanel(context, x, y, SETTINGS_WIDTH, panelHeight);

        context.drawText(textRenderer, selectedModule.name(), x + 10, y + 10, COLOR_ACCENT, false);

        int rowY = y + 26;
        for (Setting<?> setting : settings) {
            renderSetting(context, setting, x, rowY, mouseX, mouseY);
            rowY += ROW_HEIGHT;
        }

        if (isHud) {
            HudElement hud = (HudElement) selectedModule;
            renderRowLabel(context, "Opacite", x, rowY);
            renderBar(context, x, rowY, hud.layout().opacity());
            rowY += ROW_HEIGHT;

            renderRowLabel(context, "Echelle", x, rowY);
            renderBar(context, x, rowY, (hud.layout().scale() - 0.5f) / 2.5f);
            rowY += ROW_HEIGHT;

            renderRowLabel(context, "Fond", x, rowY);
            renderValue(context, hud.layout().background().label(), x, rowY);
            rowY += ROW_HEIGHT;

            renderRowLabel(context, "Ombre du texte", x, rowY);
            renderValue(context, hud.layout().textShadow() ? "Oui" : "Non", x, rowY);
        }
    }

    private void renderSetting(DrawContext context, Setting<?> setting, int x, int y, int mouseX, int mouseY) {
        renderRowLabel(context, setting.label(), x, y);

        if (setting instanceof BooleanSetting bool) {
            renderValue(context, bool.get() ? "Oui" : "Non", x, y);
        } else if (setting instanceof SliderSetting slider) {
            renderBar(context, x, y, (float) slider.fraction());
        } else if (setting instanceof EnumSetting<?> choice) {
            renderValue(context, choice.display(), x, y);
        } else if (setting instanceof ColorSetting color) {
            int swatchX = x + SETTINGS_WIDTH - 34;
            context.fill(swatchX, y + 4, swatchX + 24, y + 14, color.argb());
            drawOutline(context, swatchX, y + 4, 24, 10, 0x60FFFFFF);
        }
    }

    private void renderRowLabel(DrawContext context, String label, int x, int y) {
        context.drawText(textRenderer, label, x + 10, y + 5, COLOR_TEXT, false);
    }

    private void renderValue(DrawContext context, String value, int x, int y) {
        int textX = x + SETTINGS_WIDTH - 10 - textRenderer.getWidth(value);
        context.drawText(textRenderer, value, textX, y + 5, COLOR_ACCENT, false);
    }

    private void renderBar(DrawContext context, int x, int y, float fraction) {
        int barX = x + SETTINGS_WIDTH - 74;
        int barWidth = 64;
        context.fill(barX, y + 7, barX + barWidth, y + 11, 0x50FFFFFF);
        int filled = Math.round(barWidth * Math.min(Math.max(fraction, 0f), 1f));
        context.fill(barX, y + 7, barX + filled, y + 11, COLOR_ACCENT);
    }

    private void fillPanel(DrawContext context, int x, int y, int panelWidth, int panelHeight) {
        context.fill(x, y, x + panelWidth, y + panelHeight, COLOR_PANEL);
        drawOutline(context, x, y, panelWidth, panelHeight, COLOR_PANEL_BORDER);
    }

    private void drawOutline(DrawContext context, int x, int y, int w, int h, int color) {
        context.fill(x, y, x + w, y + 1, color);
        context.fill(x, y + h - 1, x + w, y + h, color);
        context.fill(x, y + 1, x + 1, y + h - 1, color);
        context.fill(x + w - 1, y + 1, x + w, y + h - 1, color);
    }

    private static boolean inside(double mouseX, double mouseY, int x, int y, int w, int h) {
        return mouseX >= x && mouseX < x + w && mouseY >= y && mouseY < y + h;
    }

    // ------------------------------------------------------------------ souris

    public boolean mouseClicked(int button) {
        double mouseX = this.mouseX;
        double mouseY = this.mouseY;

        if (handlePanelClick(mouseX, mouseY, button)) {
            return true;
        }
        if (selectedModule != null && handleSettingsClick(mouseX, mouseY, button)) {
            return true;
        }
        return handleHudClick(mouseX, mouseY, button);
    }

    private boolean handlePanelClick(double mouseX, double mouseY, int button) {
        if (!inside(mouseX, mouseY, PANEL_X, PANEL_Y, PANEL_WIDTH, panelHeight())) {
            return false;
        }

        int y = PANEL_Y + 34;
        for (ModuleCategory category : ModuleCategory.values()) {
            if (inside(mouseX, mouseY, PANEL_X + 6, y, PANEL_WIDTH - 12, ROW_HEIGHT)) {
                activeCategory = category;
                selectedModule = null;
                return true;
            }
            y += ROW_HEIGHT;
        }

        y += 8;
        for (Module module : visibleModules()) {
            if (inside(mouseX, mouseY, PANEL_X + 6, y, PANEL_WIDTH - 12, ROW_HEIGHT)) {
                boolean onToggle = mouseX >= PANEL_X + PANEL_WIDTH - 32;
                if (onToggle) {
                    // Un module verrouille par le serveur garde son interrupteur
                    // visible mais inerte.
                    if (!module.lockedByServer()) {
                        module.setEnabled(!module.enabledByPlayer());
                    }
                } else {
                    selectedModule = module == selectedModule ? null : module;
                }
                return true;
            }
            y += ROW_HEIGHT;
        }

        // Clic dans le panneau mais sur rien: on l'absorbe quand meme pour ne
        // pas deplacer un HUD cache derriere.
        return true;
    }

    private boolean handleSettingsClick(double mouseX, double mouseY, int button) {
        int x = PANEL_X + PANEL_WIDTH + 10;
        List<Setting<?>> settings = selectedModule.settings();
        boolean isHud = selectedModule instanceof HudElement;
        int rows = settings.size() + (isHud ? 4 : 0);
        int panelHeight = 30 + Math.max(1, rows) * ROW_HEIGHT + 10;

        if (!inside(mouseX, mouseY, x, PANEL_Y, SETTINGS_WIDTH, panelHeight)) {
            return false;
        }

        int direction = button == 1 ? -1 : 1;
        int rowY = PANEL_Y + 26;

        for (Setting<?> setting : settings) {
            if (inside(mouseX, mouseY, x, rowY, SETTINGS_WIDTH, ROW_HEIGHT)) {
                applySettingClick(setting, mouseX, x, direction);
                return true;
            }
            rowY += ROW_HEIGHT;
        }

        if (isHud) {
            HudElement hud = (HudElement) selectedModule;
            if (inside(mouseX, mouseY, x, rowY, SETTINGS_WIDTH, ROW_HEIGHT)) {
                hud.layout().setOpacity((float) barFraction(mouseX, x));
                return true;
            }
            rowY += ROW_HEIGHT;

            if (inside(mouseX, mouseY, x, rowY, SETTINGS_WIDTH, ROW_HEIGHT)) {
                hud.layout().setScale(0.5f + (float) barFraction(mouseX, x) * 2.5f);
                return true;
            }
            rowY += ROW_HEIGHT;

            if (inside(mouseX, mouseY, x, rowY, SETTINGS_WIDTH, ROW_HEIGHT)) {
                BackgroundStyle[] styles = BackgroundStyle.values();
                int next = hud.layout().background().ordinal() + direction;
                hud.layout().setBackground(styles[((next % styles.length) + styles.length) % styles.length]);
                return true;
            }
            rowY += ROW_HEIGHT;

            if (inside(mouseX, mouseY, x, rowY, SETTINGS_WIDTH, ROW_HEIGHT)) {
                hud.layout().setTextShadow(!hud.layout().textShadow());
                return true;
            }
        }

        return true;
    }

    private void applySettingClick(Setting<?> setting, double mouseX, int panelX, int direction) {
        if (setting instanceof BooleanSetting bool) {
            bool.toggle();
        } else if (setting instanceof SliderSetting slider) {
            slider.setFraction(barFraction(mouseX, panelX));
        } else if (setting instanceof EnumSetting<?> choice) {
            choice.cycle(direction);
        } else if (setting instanceof ColorSetting color) {
            // Palette courte plutot qu'un selecteur complet: suffisant pour un
            // HUD, et ca evite un composant entier a maintenir par version.
            int[] palette = {
                0xFFFFFFFF, 0xFFB07CFF, 0xFF7CD8FF, 0xFF7CFF9E, 0xFFFFE07C, 0xFFFF7C7C,
            };
            int current = 0;
            for (int i = 0; i < palette.length; i++) {
                if (palette[i] == color.argb()) {
                    current = i;
                    break;
                }
            }
            int next = ((current + direction) % palette.length + palette.length) % palette.length;
            color.set(palette[next]);
        }
    }

    private static double barFraction(double mouseX, int panelX) {
        int barX = panelX + SETTINGS_WIDTH - 74;
        return Math.min(Math.max((mouseX - barX) / 64.0, 0.0), 1.0);
    }

    private boolean handleHudClick(double mouseX, double mouseY, int button) {
        List<HudElement> elements = registry.hudElements();

        // Du dernier au premier: l'element dessine par-dessus se saisit d'abord.
        for (int i = elements.size() - 1; i >= 0; i--) {
            HudElement element = elements.get(i);
            if (!element.enabledByPlayer()) {
                continue;
            }

            int[] box = HudRegistry.bounds(element, textRenderer, width, height);
            if (!inside(mouseX, mouseY, box[0], box[1], box[2], box[3])) {
                continue;
            }

            if (button == 1) {
                selectedModule = element;
                activeCategory = element.category();
                return true;
            }

            dragged = element;
            selectedModule = element;
            dragGrabX = (int) mouseX - box[0];
            dragGrabY = (int) mouseY - box[1];
            return true;
        }

        return false;
    }

    private void updateDrag() {
        int[] box = HudRegistry.bounds(dragged, textRenderer, width, height);
        int elementWidth = box[2];
        int elementHeight = box[3];

        int x = (int) mouseX - dragGrabX;
        int y = (int) mouseY - dragGrabY;

        guidesX.clear();
        guidesY.clear();
        x = snapHorizontally(x, elementWidth);
        y = snapVertically(y, elementHeight);

        float scale = dragged.layout().scale();
        // La position est stockee dans l'espace mis a l'echelle, comme au rendu.
        dragged.layout().moveTo(
            Math.round(x / scale), Math.round(y / scale),
            (int) (width / scale), (int) (height / scale),
            Math.round(elementWidth / scale), Math.round(elementHeight / scale));
    }

    /** Aimante le bord gauche, le centre ou le bord droit de l'element. */
    private int snapHorizontally(int x, int elementWidth) {
        List<Integer> targets = new ArrayList<>(List.of(0, width / 2, width));
        for (HudElement other : registry.hudElements()) {
            if (other == dragged || !other.enabledByPlayer()) {
                continue;
            }
            int[] box = HudRegistry.bounds(other, textRenderer, width, height);
            targets.add(box[0]);
            targets.add(box[0] + box[2]);
        }

        for (int target : targets) {
            if (Math.abs(x - target) <= SNAP_DISTANCE) {
                guidesX.add(target);
                return target;
            }
            if (Math.abs(x + elementWidth - target) <= SNAP_DISTANCE) {
                guidesX.add(target);
                return target - elementWidth;
            }
            if (Math.abs(x + elementWidth / 2 - target) <= SNAP_DISTANCE) {
                guidesX.add(target);
                return target - elementWidth / 2;
            }
        }
        return x;
    }

    private int snapVertically(int y, int elementHeight) {
        List<Integer> targets = new ArrayList<>(List.of(0, height / 2, height));
        for (HudElement other : registry.hudElements()) {
            if (other == dragged || !other.enabledByPlayer()) {
                continue;
            }
            int[] box = HudRegistry.bounds(other, textRenderer, width, height);
            targets.add(box[1]);
            targets.add(box[1] + box[3]);
        }

        for (int target : targets) {
            if (Math.abs(y - target) <= SNAP_DISTANCE) {
                guidesY.add(target);
                return target;
            }
            if (Math.abs(y + elementHeight - target) <= SNAP_DISTANCE) {
                guidesY.add(target);
                return target - elementHeight;
            }
            if (Math.abs(y + elementHeight / 2 - target) <= SNAP_DISTANCE) {
                guidesY.add(target);
                return target - elementHeight / 2;
            }
        }
        return y;
    }

    public boolean mouseReleased() {
        if (dragged != null) {
            dragged = null;
            guidesX.clear();
            guidesY.clear();
            registry.save();
            return true;
        }
        return false;
    }
}

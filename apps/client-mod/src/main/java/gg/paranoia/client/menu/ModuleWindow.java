package gg.paranoia.client.menu;

import gg.paranoia.client.config.BackgroundStyle;
import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.hud.HudRegistry;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.ColorSetting;
import gg.paranoia.client.module.EnumSetting;
import gg.paranoia.client.module.KeySetting;
import gg.paranoia.client.module.Module;
import gg.paranoia.client.module.ModuleCategory;
import gg.paranoia.client.module.Setting;
import gg.paranoia.client.module.SliderSetting;
import gg.paranoia.client.platform.Platforms;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

import java.util.ArrayList;
import java.util.List;

/**
 * La fenetre du mod menu: bandeau, colonne de gauche, filtres et grille de
 * cartes.
 *
 * <p>Une carte porte tout ce qui concerne un module -- son icone, son nom, ses
 * options et son etat. L'etat a trois valeurs et non deux: un module que le
 * serveur interdit s'affiche VERROUILLE, gris et inerte, plutot que de laisser
 * croire a un interrupteur casse.
 *
 * <p>La geometrie est calculee dans {@link #layout} et relue telle quelle par le
 * clic: dessiner et cliquer a deux endroits differents est la facon la plus sure
 * de les desynchroniser.
 */
public final class ModuleWindow {
    private static final int HEADER_HEIGHT = 20;
    private static final int SIDEBAR_WIDTH = 78;
    private static final int PAD = 6;
    private static final int CHIP_HEIGHT = 13;
    private static final int CARD_HEIGHT = 62;
    private static final int CARD_MIN_WIDTH = 92;
    private static final int GAP = 5;
    private static final int ROW_HEIGHT = 12;

    /** Onglets du bandeau. Lunar en a un troisieme, Waypoints, sans objet ici. */
    private enum Tab {
        MODULES("MODULES"),
        REGLAGES("REGLAGES");

        private final String label;

        Tab(String label) {
            this.label = label;
        }
    }

    private final HudRegistry registry;

    private Tab tab = Tab.MODULES;
    /** null = "TOUT": la pastille active de la maquette. */
    private ModuleCategory filter;
    private Module options;
    private int page;

    // Geometrie de la derniere image, relue par les clics.
    private int x;
    private int y;
    private int width;
    private int height;

    public ModuleWindow(HudRegistry registry) {
        this.registry = registry;
    }

    public void reset() {
        options = null;
        page = 0;
    }

    /** Ouvre directement les reglages d'un module, depuis l'editeur de HUD. */
    public void openOptions(Module module) {
        tab = Tab.MODULES;
        options = module;
    }

    private static int clamp(int value, int min, int max) {
        return Math.max(min, Math.min(max, value));
    }

    /** Fenetre centree, large mais jamais collee aux bords. */
    private void layout(int screenWidth, int screenHeight) {
        width = clamp(screenWidth - 30, 200, 440);
        height = clamp(screenHeight - 30, 130, 250);
        x = (screenWidth - width) / 2;
        y = (screenHeight - height) / 2;
    }

    private int contentX() {
        return x + SIDEBAR_WIDTH;
    }

    private int contentY() {
        return y + HEADER_HEIGHT;
    }

    private int contentWidth() {
        return width - SIDEBAR_WIDTH;
    }

    private int contentHeight() {
        return height - HEADER_HEIGHT;
    }

    // ------------------------------------------------------------------ rendu

    public void render(
        DrawContext context, TextRenderer font,
        int screenWidth, int screenHeight, int mouseX, int mouseY) {
        layout(screenWidth, screenHeight);

        context.fill(0, 0, screenWidth, screenHeight, MenuTheme.BACKDROP);
        MenuTheme.panel(context, x, y, width, height, MenuTheme.WINDOW);
        MenuTheme.outline(context, x, y, width, height, MenuTheme.WINDOW_BORDER);

        renderHeader(context, font, mouseX, mouseY);
        renderSidebar(context, font, mouseX, mouseY);

        if (options != null) {
            renderOptions(context, font, mouseX, mouseY);
        } else if (tab == Tab.MODULES) {
            renderFilters(context, font, mouseX, mouseY);
            renderCards(context, font, mouseX, mouseY);
        } else {
            renderReglages(context, font);
        }
    }

    private void renderHeader(DrawContext context, TextRenderer font, int mouseX, int mouseY) {
        context.fill(x + 1, y + 1, x + width - 1, y + HEADER_HEIGHT, MenuTheme.HEADER);
        context.fill(x + 1, y + HEADER_HEIGHT, x + width - 1, y + HEADER_HEIGHT + 1, MenuTheme.ACCENT_DIM);

        int textY = y + (HEADER_HEIGHT - font.fontHeight) / 2;
        MenuTheme.text(context, font, "PARANOIA", x + 8, textY, MenuTheme.ACCENT);
        MenuTheme.text(context, font, "CLIENT", x + 10 + font.getWidth("PARANOIA"), textY, MenuTheme.TEXT_DIM);

        for (Tab value : Tab.values()) {
            int[] box = tabBox(font, value);
            MenuTheme.chip(context, font, value.label, box[0], box[1], box[2], CHIP_HEIGHT,
                value == tab, MenuTheme.inside(mouseX, mouseY, box[0], box[1], box[2], CHIP_HEIGHT));
        }

        int[] close = closeBox();
        boolean hovered = MenuTheme.inside(mouseX, mouseY, close[0], close[1], close[2], close[2]);
        MenuTheme.panel(context, close[0], close[1], close[2], close[2],
            hovered ? MenuTheme.STATE_OFF : MenuTheme.CARD);
        MenuTheme.centered(context, font, "x", close[0], close[2],
            close[1] + (close[2] - font.fontHeight) / 2, MenuTheme.TEXT);
    }

    /** @return {x, y, largeur} de la pastille d'un onglet. */
    private int[] tabBox(TextRenderer font, Tab value) {
        int start = x + SIDEBAR_WIDTH + PAD;
        for (Tab candidate : Tab.values()) {
            int candidateWidth = font.getWidth(candidate.label) + 16;
            if (candidate == value) {
                return new int[] {start, y + (HEADER_HEIGHT - CHIP_HEIGHT) / 2, candidateWidth};
            }
            start += candidateWidth + 4;
        }
        return new int[] {start, y, 0};
    }

    /** @return {x, y, cote} de la croix de fermeture. */
    private int[] closeBox() {
        int size = 12;
        return new int[] {x + width - size - 5, y + (HEADER_HEIGHT - size) / 2, size};
    }

    private void renderSidebar(DrawContext context, TextRenderer font, int mouseX, int mouseY) {
        context.fill(x + 1, contentY() + 1, x + SIDEBAR_WIDTH, y + height - 1, MenuTheme.SIDEBAR);
        context.fill(
            x + SIDEBAR_WIDTH, contentY() + 1, x + SIDEBAR_WIDTH + 1, y + height - 1, 0x22FFFFFF);

        MenuTheme.text(context, font, "AFFICHAGE", x + 8, contentY() + 8, MenuTheme.TEXT_DIM);

        int[] edit = editButtonBox();
        boolean hovered = MenuTheme.inside(mouseX, mouseY, edit[0], edit[1], edit[2], edit[3]);
        MenuTheme.panel(context, edit[0], edit[1], edit[2], edit[3],
            hovered ? MenuTheme.CARD_HOVER : MenuTheme.CARD);
        MenuTheme.outline(context, edit[0], edit[1], edit[2], edit[3], MenuTheme.ACCENT);
        MenuTheme.centered(context, font, "EDITER", edit[0], edit[2], edit[1] + 4, MenuTheme.ACCENT);
        MenuTheme.centered(context, font, "LES HUD", edit[0], edit[2], edit[1] + 14, MenuTheme.ACCENT);

        MenuTheme.text(context, font, "Maj droite", x + 8, y + height - 22, MenuTheme.TEXT_DIM);
        MenuTheme.text(context, font, "pour fermer", x + 8, y + height - 13, MenuTheme.TEXT_DIM);
    }

    /** @return {x, y, largeur, hauteur} du bouton d'edition des HUD. */
    private int[] editButtonBox() {
        return new int[] {x + 8, contentY() + 22, SIDEBAR_WIDTH - 16, 26};
    }

    private void renderFilters(DrawContext context, TextRenderer font, int mouseX, int mouseY) {
        for (int index = 0; index < filters().size(); index++) {
            int[] box = filterBox(font, index);
            ModuleCategory category = filters().get(index);
            boolean active = category == filter;
            MenuTheme.chip(context, font, filterLabel(category), box[0], box[1], box[2], CHIP_HEIGHT,
                active, MenuTheme.inside(mouseX, mouseY, box[0], box[1], box[2], CHIP_HEIGHT));
        }
    }

    /** Les pastilles de filtre: "TOUT" puis une par categorie. */
    private List<ModuleCategory> filters() {
        List<ModuleCategory> list = new ArrayList<>();
        list.add(null);
        for (ModuleCategory category : ModuleCategory.values()) {
            if (hasModules(category)) {
                list.add(category);
            }
        }
        return list;
    }

    private boolean hasModules(ModuleCategory category) {
        for (Module module : registry.all()) {
            if (module.category() == category) {
                return true;
            }
        }
        return false;
    }

    private static String filterLabel(ModuleCategory category) {
        return category == null ? "TOUT" : category.label().toUpperCase();
    }

    private int[] filterBox(TextRenderer font, int index) {
        int start = contentX() + PAD;
        List<ModuleCategory> list = filters();
        for (int i = 0; i < list.size(); i++) {
            int chipWidth = font.getWidth(filterLabel(list.get(i))) + 14;
            if (i == index) {
                return new int[] {start, contentY() + PAD, chipWidth};
            }
            start += chipWidth + 4;
        }
        return new int[] {start, contentY() + PAD, 0};
    }

    // ------------------------------------------------------------ grille

    private List<Module> visibleModules() {
        List<Module> visible = new ArrayList<>();
        for (Module module : registry.all()) {
            if (filter == null || module.category() == filter) {
                visible.add(module);
            }
        }
        return visible;
    }

    private int gridX() {
        return contentX() + PAD;
    }

    private int gridY() {
        return contentY() + PAD + CHIP_HEIGHT + PAD;
    }

    private int gridWidth() {
        return contentWidth() - PAD * 2;
    }

    private int gridHeight() {
        return contentHeight() - (gridY() - contentY()) - PAD - 10;
    }

    private int columns() {
        return Math.max(1, (gridWidth() + GAP) / (CARD_MIN_WIDTH + GAP));
    }

    private int rows() {
        return Math.max(1, (gridHeight() + GAP) / (CARD_HEIGHT + GAP));
    }

    private int perPage() {
        return columns() * rows();
    }

    private int pageCount() {
        return Math.max(1, (visibleModules().size() + perPage() - 1) / perPage());
    }

    private int cardWidth() {
        int columns = columns();
        return (gridWidth() - (columns - 1) * GAP) / columns;
    }

    private void renderCards(DrawContext context, TextRenderer font, int mouseX, int mouseY) {
        List<Module> modules = visibleModules();
        page = clamp(page, 0, pageCount() - 1);

        int first = page * perPage();
        int last = Math.min(modules.size(), first + perPage());

        for (int index = first; index < last; index++) {
            int[] box = cardBox(index - first);
            renderCard(context, font, modules.get(index), box[0], box[1], box[2], mouseX, mouseY);
        }

        if (modules.isEmpty()) {
            MenuTheme.text(context, font, "Aucun module dans cette categorie",
                gridX(), gridY() + 4, MenuTheme.TEXT_DIM);
        }

        renderPager(context, font, mouseX, mouseY);
    }

    /** @return {x, y, largeur} de la carte a la position donnee dans la page. */
    private int[] cardBox(int slot) {
        int columns = columns();
        int column = slot % columns;
        int row = slot / columns;
        return new int[] {
            gridX() + column * (cardWidth() + GAP),
            gridY() + row * (CARD_HEIGHT + GAP),
            cardWidth(),
        };
    }

    private void renderCard(
        DrawContext context, TextRenderer font, Module module,
        int cardX, int cardY, int cardWidth, int mouseX, int mouseY) {
        boolean hovered = MenuTheme.inside(mouseX, mouseY, cardX, cardY, cardWidth, CARD_HEIGHT);
        MenuTheme.panel(context, cardX, cardY, cardWidth, CARD_HEIGHT,
            hovered ? MenuTheme.CARD_HOVER : MenuTheme.CARD);
        MenuTheme.outline(context, cardX, cardY, cardWidth, CARD_HEIGHT, MenuTheme.CARD_BORDER);

        int pixel = 2;
        int iconSize = ModuleIcons.size(pixel);
        int iconColor = module.lockedByServer() ? MenuTheme.TEXT_DIM
            : (module.enabledByPlayer() ? MenuTheme.ACCENT : MenuTheme.TEXT_DIM);
        ModuleIcons.draw(
            context, module.id(), cardX + (cardWidth - iconSize) / 2, cardY + 6, pixel, iconColor);

        MenuTheme.centered(context, font, MenuTheme.fit(font, module.name(), cardWidth - 8),
            cardX, cardWidth, cardY + 27, MenuTheme.TEXT);

        // Ligne OPTIONS: absente quand le module n'a rien a regler, plutot qu'un
        // bouton qui ouvrirait un panneau vide.
        int optionsY = cardY + 38;
        if (hasOptions(module)) {
            boolean optionsHovered =
                MenuTheme.inside(mouseX, mouseY, cardX + 4, optionsY, cardWidth - 8, 10);
            if (optionsHovered) {
                context.fill(cardX + 4, optionsY, cardX + cardWidth - 4, optionsY + 10, MenuTheme.ROW_HOVER);
            }
            MenuTheme.centered(context, font, "OPTIONS", cardX, cardWidth, optionsY + 1,
                optionsHovered ? MenuTheme.TEXT : MenuTheme.TEXT_DIM);
        }

        renderStateButton(context, font, module, cardX, cardY, cardWidth, mouseX, mouseY);
    }

    private boolean hasOptions(Module module) {
        return !module.settings().isEmpty() || module instanceof HudElement;
    }

    private void renderStateButton(
        DrawContext context, TextRenderer font, Module module,
        int cardX, int cardY, int cardWidth, int mouseX, int mouseY) {
        int buttonY = cardY + CARD_HEIGHT - 13;
        int buttonHeight = 11;
        boolean hovered =
            MenuTheme.inside(mouseX, mouseY, cardX + 4, buttonY, cardWidth - 8, buttonHeight);

        int color;
        String label;
        if (module.lockedByServer()) {
            color = MenuTheme.STATE_LOCKED;
            label = "VERROUILLE";
        } else if (module.enabledByPlayer()) {
            color = hovered ? MenuTheme.STATE_ON_HOVER : MenuTheme.STATE_ON;
            label = "ACTIVE";
        } else {
            color = hovered ? MenuTheme.STATE_OFF_HOVER : MenuTheme.STATE_OFF;
            label = "DESACTIVE";
        }

        MenuTheme.panel(context, cardX + 4, buttonY, cardWidth - 8, buttonHeight, color);
        MenuTheme.centered(context, font, MenuTheme.fit(font, label, cardWidth - 12),
            cardX + 4, cardWidth - 8, buttonY + 2, 0xFFFFFFFF);
    }

    private void renderPager(DrawContext context, TextRenderer font, int mouseX, int mouseY) {
        if (pageCount() <= 1) {
            return;
        }

        int pagerY = y + height - 12;
        String label = (page + 1) + "/" + pageCount();

        int[] previous = pagerBox(false);
        int[] next = pagerBox(true);

        MenuTheme.centered(context, font, "<", previous[0], previous[2], pagerY,
            MenuTheme.inside(mouseX, mouseY, previous[0], previous[1], previous[2], 10)
                ? MenuTheme.ACCENT : MenuTheme.TEXT_DIM);
        MenuTheme.centered(context, font, ">", next[0], next[2], pagerY,
            MenuTheme.inside(mouseX, mouseY, next[0], next[1], next[2], 10)
                ? MenuTheme.ACCENT : MenuTheme.TEXT_DIM);
        MenuTheme.centered(context, font, label, previous[0] + previous[2], 24, pagerY, MenuTheme.TEXT_DIM);
    }

    /** @return {x, y, largeur} d'une fleche de pagination. */
    private int[] pagerBox(boolean forward) {
        int arrowWidth = 12;
        int right = x + width - PAD;
        int start = right - arrowWidth * 2 - 24;
        return new int[] {
            forward ? right - arrowWidth : start,
            y + height - 14,
            arrowWidth,
        };
    }

    // ------------------------------------------------------------- reglages

    private void renderReglages(DrawContext context, TextRenderer font) {
        int rowY = contentY() + PAD + 2;

        MenuTheme.text(context, font, "Touche d'ouverture", contentX() + PAD, rowY, MenuTheme.TEXT);
        MenuTheme.right(context, font, "Maj droite", contentX(), contentWidth() - PAD, rowY, MenuTheme.ACCENT);
        rowY += ROW_HEIGHT + 2;

        MenuTheme.text(context, font, "Minecraft", contentX() + PAD, rowY, MenuTheme.TEXT);
        MenuTheme.right(context, font, Platforms.get().minecraftVersion(),
            contentX(), contentWidth() - PAD, rowY, MenuTheme.ACCENT);
        rowY += ROW_HEIGHT + 2;

        MenuTheme.text(context, font, "Modules", contentX() + PAD, rowY, MenuTheme.TEXT);
        MenuTheme.right(context, font, String.valueOf(registry.all().size()),
            contentX(), contentWidth() - PAD, rowY, MenuTheme.ACCENT);
        rowY += ROW_HEIGHT + 8;

        MenuTheme.text(context, font, "Les modules grises sont interdits par le serveur",
            contentX() + PAD, rowY, MenuTheme.TEXT_DIM);
        rowY += ROW_HEIGHT;
        MenuTheme.text(context, font, "sur lequel vous jouez. Ils redeviennent",
            contentX() + PAD, rowY, MenuTheme.TEXT_DIM);
        rowY += ROW_HEIGHT;
        MenuTheme.text(context, font, "disponibles ailleurs.",
            contentX() + PAD, rowY, MenuTheme.TEXT_DIM);
    }

    // -------------------------------------------------------------- options

    private void renderOptions(DrawContext context, TextRenderer font, int mouseX, int mouseY) {
        int[] back = backBox(font);
        boolean hovered = MenuTheme.inside(mouseX, mouseY, back[0], back[1], back[2], CHIP_HEIGHT);
        MenuTheme.chip(context, font, "< RETOUR", back[0], back[1], back[2], CHIP_HEIGHT, false, hovered);

        MenuTheme.text(context, font, options.name(),
            back[0] + back[2] + 8, back[1] + 3, MenuTheme.ACCENT);

        int rowY = gridY();
        for (Setting<?> setting : options.settings()) {
            renderSettingRow(context, font, setting, rowY, mouseX, mouseY);
            rowY += ROW_HEIGHT;
        }

        if (options instanceof HudElement hud) {
            renderLabel(context, font, "Opacite", rowY);
            renderBar(context, rowY, hud.layout().opacity());
            rowY += ROW_HEIGHT;

            renderLabel(context, font, "Taille", rowY);
            renderBar(context, rowY, (hud.layout().scale() - 0.5f) / 2.5f);
            rowY += ROW_HEIGHT;

            renderLabel(context, font, "Fond", rowY);
            renderValue(context, font, hud.layout().background().label(), rowY);
            rowY += ROW_HEIGHT;

            renderLabel(context, font, "Ombre du texte", rowY);
            renderValue(context, font, hud.layout().textShadow() ? "Oui" : "Non", rowY);
        }
    }

    private int[] backBox(TextRenderer font) {
        return new int[] {contentX() + PAD, contentY() + PAD, font.getWidth("< RETOUR") + 14};
    }

    private void renderSettingRow(
        DrawContext context, TextRenderer font, Setting<?> setting, int rowY, int mouseX, int mouseY) {
        if (MenuTheme.inside(mouseX, mouseY, gridX(), rowY, gridWidth(), ROW_HEIGHT)) {
            context.fill(gridX(), rowY - 1, gridX() + gridWidth(), rowY + ROW_HEIGHT - 2, MenuTheme.ROW_HOVER);
        }

        renderLabel(context, font, setting.label(), rowY);

        if (setting instanceof BooleanSetting value) {
            renderValue(context, font, value.get() ? "Oui" : "Non", rowY);
        } else if (setting instanceof SliderSetting slider) {
            renderBar(context, rowY, (float) slider.fraction());
        } else if (setting instanceof EnumSetting<?> choice) {
            renderValue(context, font, choice.display(), rowY);
        } else if (setting instanceof KeySetting key) {
            // L'invite se distingue de la valeur: sinon on ne sait pas si le
            // champ attend une frappe ou affiche une touche nommee ainsi.
            MenuTheme.right(context, font, key.display(), gridX(), gridWidth() - 2, rowY,
                key.waiting() ? MenuTheme.TEXT : MenuTheme.ACCENT);
        } else if (setting instanceof ColorSetting color) {
            int swatchX = gridX() + gridWidth() - 26;
            context.fill(swatchX, rowY + 1, swatchX + 24, rowY + 8, color.argb());
            MenuTheme.outline(context, swatchX, rowY + 1, 24, 7, 0x60FFFFFF);
        }
    }

    private void renderLabel(DrawContext context, TextRenderer font, String label, int rowY) {
        MenuTheme.text(context, font, MenuTheme.fit(font, label, gridWidth() - 80),
            gridX() + 2, rowY, MenuTheme.TEXT);
    }

    private void renderValue(DrawContext context, TextRenderer font, String value, int rowY) {
        MenuTheme.right(context, font, value, gridX(), gridWidth() - 2, rowY, MenuTheme.ACCENT);
    }

    private void renderBar(DrawContext context, int rowY, float fraction) {
        int barX = barX();
        context.fill(barX, rowY + 3, barX + barWidth(), rowY + 6, 0x50FFFFFF);
        int filled = Math.round(barWidth() * Math.min(Math.max(fraction, 0f), 1f));
        context.fill(barX, rowY + 3, barX + filled, rowY + 6, MenuTheme.ACCENT);
    }

    private int barWidth() {
        return 64;
    }

    private int barX() {
        return gridX() + gridWidth() - barWidth() - 2;
    }

    // ----------------------------------------------------------------- souris

    /** @return true si le clic demande l'ouverture du mode edition des HUD. */
    public boolean mouseClicked(TextRenderer font, int mouseX, int mouseY, int button) {
        int[] close = closeBox();
        if (MenuTheme.inside(mouseX, mouseY, close[0], close[1], close[2], close[2])) {
            closeRequested = true;
            return false;
        }

        int[] edit = editButtonBox();
        if (MenuTheme.inside(mouseX, mouseY, edit[0], edit[1], edit[2], edit[3])) {
            return true;
        }

        for (Tab value : Tab.values()) {
            int[] box = tabBox(font, value);
            if (MenuTheme.inside(mouseX, mouseY, box[0], box[1], box[2], CHIP_HEIGHT)) {
                tab = value;
                options = null;
                return false;
            }
        }

        if (options != null) {
            handleOptionsClick(font, mouseX, mouseY, button);
            return false;
        }

        if (tab == Tab.MODULES) {
            handleModulesClick(font, mouseX, mouseY);
        }
        return false;
    }

    /**
     * Demande de fermeture emise par la croix.
     *
     * <p>Un booleen plutot qu'un retour: {@code mouseClicked} rend deja
     * l'ouverture de l'editeur, et deux sorties valent mieux qu'un code de
     * retour a trois valeurs qu'il faudrait decoder de l'autre cote.
     */
    private boolean closeRequested;

    public boolean pollCloseRequest() {
        boolean requested = closeRequested;
        closeRequested = false;
        return requested;
    }

    private void handleModulesClick(TextRenderer font, int mouseX, int mouseY) {
        List<ModuleCategory> categories = filters();
        for (int index = 0; index < categories.size(); index++) {
            int[] box = filterBox(font, index);
            if (MenuTheme.inside(mouseX, mouseY, box[0], box[1], box[2], CHIP_HEIGHT)) {
                filter = categories.get(index);
                page = 0;
                return;
            }
        }

        if (pageCount() > 1) {
            int[] previous = pagerBox(false);
            int[] next = pagerBox(true);
            if (MenuTheme.inside(mouseX, mouseY, previous[0], previous[1], previous[2], 10)) {
                page = Math.max(0, page - 1);
                return;
            }
            if (MenuTheme.inside(mouseX, mouseY, next[0], next[1], next[2], 10)) {
                page = Math.min(pageCount() - 1, page + 1);
                return;
            }
        }

        List<Module> modules = visibleModules();
        int first = page * perPage();
        int last = Math.min(modules.size(), first + perPage());

        for (int index = first; index < last; index++) {
            int[] box = cardBox(index - first);
            int cardX = box[0];
            int cardY = box[1];
            int cardWidth = box[2];
            if (!MenuTheme.inside(mouseX, mouseY, cardX, cardY, cardWidth, CARD_HEIGHT)) {
                continue;
            }

            Module module = modules.get(index);
            int stateY = cardY + CARD_HEIGHT - 13;

            if (MenuTheme.inside(mouseX, mouseY, cardX + 4, stateY, cardWidth - 8, 11)) {
                // Un module verrouille garde son bouton visible mais inerte:
                // l'etat affiche dit deja pourquoi il ne repond pas.
                if (!module.lockedByServer()) {
                    module.setEnabled(!module.enabledByPlayer());
                    registry.save();
                }
                return;
            }

            if (hasOptions(module)
                && MenuTheme.inside(mouseX, mouseY, cardX + 4, cardY + 38, cardWidth - 8, 10)) {
                options = module;
            }
            return;
        }
    }

    private void handleOptionsClick(TextRenderer font, int mouseX, int mouseY, int button) {
        int[] back = backBox(font);
        if (MenuTheme.inside(mouseX, mouseY, back[0], back[1], back[2], CHIP_HEIGHT)) {
            options = null;
            registry.save();
            return;
        }

        // Clic droit: on parcourt les valeurs a l'envers. Indispensable pour les
        // listes a plus de deux choix, sinon il faut faire le tour complet.
        int direction = button == 1 ? -1 : 1;
        int rowY = gridY();

        for (Setting<?> setting : options.settings()) {
            if (MenuTheme.inside(mouseX, mouseY, gridX(), rowY, gridWidth(), ROW_HEIGHT)) {
                applySetting(setting, mouseX, direction);
                registry.save();
                return;
            }
            rowY += ROW_HEIGHT;
        }

        if (!(options instanceof HudElement hud)) {
            return;
        }

        if (MenuTheme.inside(mouseX, mouseY, gridX(), rowY, gridWidth(), ROW_HEIGHT)) {
            hud.layout().setOpacity((float) barFraction(mouseX));
        } else if (MenuTheme.inside(mouseX, mouseY, gridX(), rowY + ROW_HEIGHT, gridWidth(), ROW_HEIGHT)) {
            hud.layout().setScale(0.5f + (float) barFraction(mouseX) * 2.5f);
        } else if (MenuTheme.inside(mouseX, mouseY, gridX(), rowY + ROW_HEIGHT * 2, gridWidth(), ROW_HEIGHT)) {
            BackgroundStyle[] styles = BackgroundStyle.values();
            int next = hud.layout().background().ordinal() + direction;
            hud.layout().setBackground(styles[((next % styles.length) + styles.length) % styles.length]);
        } else if (MenuTheme.inside(mouseX, mouseY, gridX(), rowY + ROW_HEIGHT * 3, gridWidth(), ROW_HEIGHT)) {
            hud.layout().setTextShadow(!hud.layout().textShadow());
        } else {
            return;
        }

        registry.save();
    }

    private void applySetting(Setting<?> setting, int mouseX, int direction) {
        if (setting instanceof BooleanSetting value) {
            value.toggle();
        } else if (setting instanceof SliderSetting slider) {
            slider.setFraction(barFraction(mouseX));
        } else if (setting instanceof EnumSetting<?> choice) {
            choice.cycle(direction);
        } else if (setting instanceof KeySetting key) {
            // Un second clic annule l'attente: on ne reste pas coince dedans.
            if (key.waiting()) {
                KeySetting.cancelCapture();
            } else {
                key.beginCapture();
            }
        } else if (setting instanceof ColorSetting color) {
            // Palette courte plutot qu'un selecteur complet: suffisant pour un
            // HUD, et ca evite un composant entier a maintenir par version.
            int[] palette = {
                0xFFFFFFFF, 0xFFB07CFF, 0xFF7CD8FF, 0xFF7CFF9E, 0xFFFFE07C, 0xFFFF7C7C,
            };
            int current = 0;
            for (int index = 0; index < palette.length; index++) {
                if (palette[index] == color.argb()) {
                    current = index;
                    break;
                }
            }
            color.set(palette[((current + direction) % palette.length + palette.length) % palette.length]);
        }
    }

    private double barFraction(int mouseX) {
        return Math.min(Math.max((mouseX - barX()) / (double) barWidth(), 0.0), 1.0);
    }
}

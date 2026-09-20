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
 * La fenetre du mod menu: bandeau, rail de categories, grille de cartes et
 * panneau de reglages.
 *
 * <p>Trois colonnes, comme la maquette. Le rail de gauche porte les categories
 * avec leur compte, la grille du milieu une carte par module, et la colonne de
 * droite les reglages de celui qu'on vient de choisir. La disposition
 * precedente etait plus pauvre a chaque poste: les categories etaient des
 * pastilles perdues en haut, la carte ne disait que le nom du module, et ouvrir
 * ses reglages remplacait toute la grille -- on perdait de vue ce qu'on
 * reglait.
 *
 * <p>La colonne de droite disparait quand la fenetre est trop etroite pour
 * porter trois colonnes. Les reglages reprennent alors la place de la grille,
 * avec un bouton de retour: c'est exactement l'ancien comportement, garde pour
 * le seul cas ou il vaut mieux que rien.
 *
 * <p>La geometrie est calculee dans {@link #layout} et relue telle quelle par le
 * clic: dessiner et cliquer a deux endroits differents est la facon la plus sure
 * de les desynchroniser.
 */
public final class ModuleWindow {
    /** Rayon du cadre, plus large que celui des cartes qu'il contient. */
    private static final int WINDOW_RADIUS = 6;

    private static final int HEADER_HEIGHT = 22;
    private static final int RAIL_WIDTH = 92;
    private static final int PANEL_WIDTH = 150;
    private static final int PAD = 7;
    private static final int GAP = 6;
    private static final int CHIP_HEIGHT = 13;
    private static final int CARD_HEIGHT = 52;

    /**
     * Sous cette largeur, une carte ne peut plus porter son texte.
     *
     * <p>C'est aussi ce qui decide de l'affichage de la colonne de droite: elle
     * n'apparait que s'il reste au moins une colonne de cartes a cote d'elle.
     */
    private static final int CARD_MIN_WIDTH = 150;

    private static final int ROW_HEIGHT = 12;

    /** Hauteur d'une entree du rail de categories. */
    private static final int RAIL_ROW = 13;

    /** Bornes de la barre d'un curseur: assez large pour se saisir, jamais geante. */
    private static final int BAR_MIN = 28;

    private static final int BAR_MAX = 64;

    /** Largeur reservee au nuancier d'un reglage de couleur, ecart compris. */
    private static final int SWATCH_WIDTH = 26;

    /** Ecart entre le chiffre d'un curseur et sa barre. */
    private static final int VALUE_GAP = 5;

    /** Onglets du bandeau. */
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
    /** null = "TOUT": la premiere entree du rail. */
    private ModuleCategory filter;
    private Module options;
    private int page;
    private boolean closeRequested;

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

    /**
     * Fenetre centree, large.
     *
     * <p>Elle plafonnait a 440 sur 250, ce qui ne laissait la place ni a une
     * description ni a une troisieme colonne. La maquette, elle, occupe l'ecran
     * entier. On s'en approche sans y aller tout a fait: un menu qui recouvre
     * tout donne l'impression d'avoir quitte la partie.
     */
    private void layout(int screenWidth, int screenHeight) {
        width = clamp(screenWidth - 40, 240, 620);
        height = clamp(screenHeight - 40, 160, 340);
        x = (screenWidth - width) / 2;
        y = (screenHeight - height) / 2;
    }

    private int contentY() {
        return y + HEADER_HEIGHT;
    }

    private int railX() {
        return x + 1;
    }

    /** La colonne de droite ne s'affiche que s'il reste une colonne de cartes. */
    private boolean panelVisible() {
        return width - RAIL_WIDTH - PANEL_WIDTH - PAD * 3 >= CARD_MIN_WIDTH;
    }

    private int panelX() {
        return x + width - PANEL_WIDTH;
    }

    private int gridX() {
        return x + RAIL_WIDTH + PAD;
    }

    private int gridWidth() {
        int right = panelVisible() ? panelX() - PAD : x + width - PAD;
        return right - gridX();
    }

    private int gridY() {
        return contentY() + PAD;
    }

    private int gridHeight() {
        return y + height - PAD - 10 - gridY();
    }

    // ------------------------------------------------------------------ rendu

    public void render(
        DrawContext context, TextRenderer font,
        int screenWidth, int screenHeight, int mouseX, int mouseY) {
        layout(screenWidth, screenHeight);

        context.fill(0, 0, screenWidth, screenHeight, MenuTheme.BACKDROP);
        // Le cadre prend un rayon plus large que les cartes qu'il contient:
        // c'est la hierarchie de la maquette, 14 pixels pour le cadre contre 8
        // pour les cartes.
        MenuTheme.panel(context, x, y, width, height, WINDOW_RADIUS, MenuTheme.WINDOW);
        MenuTheme.outline(context, x, y, width, height, WINDOW_RADIUS, MenuTheme.WINDOW_BORDER);

        renderHeader(context, font, mouseX, mouseY);
        renderRail(context, font, mouseX, mouseY);

        if (tab == Tab.REGLAGES) {
            renderReglages(context, font);
            return;
        }

        // Etroite: les reglages prennent la place de la grille. Large: les deux
        // cohabitent, et c'est tout l'interet de la troisieme colonne.
        if (options != null && !panelVisible()) {
            renderOptions(context, font, gridX(), gridWidth(), gridY(), mouseX, mouseY, true);
            return;
        }

        renderCards(context, font, mouseX, mouseY);
        if (panelVisible()) {
            renderPanel(context, font, mouseX, mouseY);
        }
    }

    // ----------------------------------------------------------------- bandeau

    private void renderHeader(DrawContext context, TextRenderer font, int mouseX, int mouseY) {
        MenuTheme.panelTop(context, x + 1, y + 1, width - 2, HEADER_HEIGHT - 1,
            WINDOW_RADIUS - 1, MenuTheme.HEADER);
        context.fill(x + 1, y + HEADER_HEIGHT, x + width - 1, y + HEADER_HEIGHT + 1,
            MenuTheme.ACCENT_DIM);

        int textY = y + (HEADER_HEIGHT - font.fontHeight) / 2;
        MenuTheme.text(context, font, "PARANOIA", x + 8, textY, MenuTheme.ACCENT);
        MenuTheme.text(context, font, "CLIENT",
            x + 10 + font.getWidth("PARANOIA"), textY, MenuTheme.TEXT_DIM);

        for (Tab value : Tab.values()) {
            int[] box = tabBox(font, value);
            MenuTheme.chip(context, font, value.label, box[0], box[1], box[2], CHIP_HEIGHT,
                value == tab, MenuTheme.inside(mouseX, mouseY, box[0], box[1], box[2], CHIP_HEIGHT));
        }

        int[] close = closeBox();

        // Le compte de la maquette, « 34 mods actifs ». Il tient a droite du
        // bandeau, avant la croix, et disparait quand la fenetre est trop etroite
        // pour le porter sans chevaucher les onglets.
        String count = activeCount() + " ACTIFS";
        int countX = close[0] - 8 - font.getWidth(count);
        int[] lastTab = tabBox(font, Tab.values()[Tab.values().length - 1]);
        if (countX > lastTab[0] + lastTab[2] + 8) {
            MenuTheme.text(context, font, count, countX, textY, MenuTheme.TEXT_DIM);
        }

        boolean hovered = MenuTheme.inside(mouseX, mouseY, close[0], close[1], close[2], close[2]);
        MenuTheme.panel(context, close[0], close[1], close[2], close[2],
            hovered ? MenuTheme.STATE_OFF : MenuTheme.CARD);
        MenuTheme.centered(context, font, "x", close[0], close[2],
            close[1] + (close[2] - font.fontHeight) / 2, MenuTheme.TEXT);
    }

    private int activeCount() {
        int active = 0;
        for (Module module : registry.all()) {
            if (module.enabled()) {
                active++;
            }
        }
        return active;
    }

    /** @return {x, y, largeur} de la pastille d'un onglet. */
    private int[] tabBox(TextRenderer font, Tab value) {
        int start = x + RAIL_WIDTH + PAD;
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
        return new int[] {x + width - size - 6, y + (HEADER_HEIGHT - size) / 2, size};
    }

    // -------------------------------------------------------------------- rail

    private void renderRail(DrawContext context, TextRenderer font, int mouseX, int mouseY) {
        MenuTheme.panelBottom(context, railX(), contentY() + 1, RAIL_WIDTH - 1,
            y + height - 1 - (contentY() + 1), WINDOW_RADIUS - 1, MenuTheme.SIDEBAR);
        context.fill(x + RAIL_WIDTH, contentY() + 1, x + RAIL_WIDTH + 1, y + height - 1, 0x22FFFFFF);

        MenuTheme.text(context, font, "CATEGORIES", railX() + 7, contentY() + 7, MenuTheme.TEXT_DIM);

        List<ModuleCategory> list = filters();
        for (int index = 0; index < list.size(); index++) {
            ModuleCategory category = list.get(index);
            int[] box = railBox(index);
            boolean active = category == filter;
            boolean hovered = MenuTheme.inside(mouseX, mouseY, box[0], box[1], box[2], RAIL_ROW);

            if (active || hovered) {
                MenuTheme.panel(context, box[0], box[1], box[2], RAIL_ROW,
                    active ? MenuTheme.CARD_HOVER : MenuTheme.ROW_HOVER);
            }
            if (active) {
                // Le trait de la maquette: 2 px colles au bord gauche de la
                // ligne, qui disent « ici » sans repeindre toute la rangee.
                context.fill(box[0], box[1] + 2, box[0] + 2, box[1] + RAIL_ROW - 2, MenuTheme.ACCENT);
            }

            int labelY = box[1] + (RAIL_ROW - font.fontHeight) / 2 + 1;
            String label = filterLabel(category);
            String total = String.valueOf(countOf(category));
            int room = box[2] - 10 - font.getWidth(total) - 4;
            MenuTheme.text(context, font, MenuTheme.fit(font, label, room), box[0] + 6, labelY,
                active ? MenuTheme.TEXT : MenuTheme.TEXT_DIM);
            MenuTheme.right(context, font, total, box[0], box[2] - 5, labelY, MenuTheme.TEXT_DIM);
        }

        int[] edit = editButtonBox();
        boolean hovered = MenuTheme.inside(mouseX, mouseY, edit[0], edit[1], edit[2], edit[3]);
        MenuTheme.panel(context, edit[0], edit[1], edit[2], edit[3],
            hovered ? MenuTheme.CARD_HOVER : MenuTheme.CARD);
        MenuTheme.outline(context, edit[0], edit[1], edit[2], edit[3], MenuTheme.ACCENT);
        MenuTheme.centered(context, font, "EDITER", edit[0], edit[2], edit[1] + 4, MenuTheme.ACCENT);
        MenuTheme.centered(context, font, "LES HUD", edit[0], edit[2], edit[1] + 14, MenuTheme.ACCENT);

        MenuTheme.text(context, font, "Maj droite", railX() + 7, y + height - 21, MenuTheme.TEXT_DIM);
        MenuTheme.text(context, font, "pour fermer", railX() + 7, y + height - 12, MenuTheme.TEXT_DIM);
    }

    /** @return {x, y, largeur} d'une entree du rail. */
    private int[] railBox(int index) {
        return new int[] {railX() + 4, contentY() + 19 + index * (RAIL_ROW + 1), RAIL_WIDTH - 9};
    }

    /** @return {x, y, largeur, hauteur} du bouton d'edition des HUD. */
    private int[] editButtonBox() {
        return new int[] {railX() + 6, y + height - 53, RAIL_WIDTH - 13, 26};
    }

    /** Les entrees du rail: "TOUT" puis une par categorie peuplee. */
    private List<ModuleCategory> filters() {
        List<ModuleCategory> list = new ArrayList<>();
        list.add(null);
        for (ModuleCategory category : ModuleCategory.values()) {
            if (countOf(category) > 0) {
                list.add(category);
            }
        }
        return list;
    }

    private int countOf(ModuleCategory category) {
        int total = 0;
        for (Module module : registry.all()) {
            if (category == null || module.category() == category) {
                total++;
            }
        }
        return total;
    }

    private static String filterLabel(ModuleCategory category) {
        return category == null ? "Tout" : category.label();
    }

    // ------------------------------------------------------------------ cartes

    private List<Module> visibleModules() {
        List<Module> visible = new ArrayList<>();
        for (Module module : registry.all()) {
            if (filter == null || module.category() == filter) {
                visible.add(module);
            }
        }
        return visible;
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
        return new int[] {
            gridX() + (slot % columns) * (cardWidth() + GAP),
            gridY() + (slot / columns) * (CARD_HEIGHT + GAP),
            cardWidth(),
        };
    }

    /**
     * Une carte de la maquette: icone, nom, interrupteur, description, categorie.
     *
     * <p>Elle ne portait que l'icone, le nom et un bandeau d'etat. La
     * description est ce qui manquait le plus: le nom seul ne dit pas ce que
     * fait « Color hit » ni ce que coute « Alleger le decor lointain ».
     */
    private void renderCard(
        DrawContext context, TextRenderer font, Module module,
        int cardX, int cardY, int cardWidth, int mouseX, int mouseY) {
        boolean hovered = MenuTheme.inside(mouseX, mouseY, cardX, cardY, cardWidth, CARD_HEIGHT);
        boolean selected = module == options;

        MenuTheme.panel(context, cardX, cardY, cardWidth, CARD_HEIGHT,
            selected || hovered ? MenuTheme.CARD_HOVER : MenuTheme.CARD);
        MenuTheme.outline(context, cardX, cardY, cardWidth, CARD_HEIGHT,
            selected ? MenuTheme.ACCENT : MenuTheme.CARD_BORDER);

        int pixel = 1;
        int iconSize = ModuleIcons.size(pixel);
        int iconColor = module.lockedByServer() ? MenuTheme.STATE_LOCKED
            : (module.enabledByPlayer() ? MenuTheme.ACCENT : MenuTheme.TEXT_DIM);
        ModuleIcons.draw(context, module.id(), cardX + 7, cardY + 7, pixel, iconColor);

        int[] toggle = toggleBox(cardX, cardY, cardWidth);
        MenuTheme.toggle(context, toggle[0], toggle[1],
            module.enabledByPlayer(), module.lockedByServer());

        int nameX = cardX + 7 + iconSize + 5;
        int nameRoom = toggle[0] - 6 - nameX;
        MenuTheme.text(context, font, MenuTheme.fit(font, module.name(), nameRoom),
            nameX, cardY + 7, MenuTheme.TEXT);

        int textWidth = cardWidth - 14;
        List<String> description = MenuTheme.wrap(font, module.description(), textWidth, 2);
        for (int line = 0; line < description.size(); line++) {
            MenuTheme.text(context, font, description.get(line),
                cardX + 7, cardY + 20 + line * 9, MenuTheme.TEXT_DIM);
        }

        renderPill(context, font, module, cardX + 7, cardY + CARD_HEIGHT - 14);
    }

    /** @return {x, y} de l'interrupteur d'une carte. */
    private int[] toggleBox(int cardX, int cardY, int cardWidth) {
        return new int[] {cardX + cardWidth - 7 - MenuTheme.toggleWidth(), cardY + 7};
    }

    /**
     * La pastille de categorie, et celle du verrou quand le serveur l'impose.
     *
     * <p>Le verrou passe avant la categorie: c'est la seule chose qui explique
     * pourquoi l'interrupteur ne repond pas.
     */
    private void renderPill(
        DrawContext context, TextRenderer font, Module module, int pillX, int pillY) {
        String label;
        int text;
        int background;
        if (module.lockedByServer()) {
            label = "VERROUILLE";
            text = 0xFFFFFFFF;
            background = MenuTheme.STATE_OFF;
        } else {
            label = module.category().label();
            text = MenuTheme.ACCENT;
            background = MenuTheme.ACCENT_DIM;
        }

        int pillWidth = font.getWidth(label) + 10;
        MenuTheme.panel(context, pillX, pillY, pillWidth, 11, 5, background);
        MenuTheme.centered(context, font, label, pillX, pillWidth, pillY + 2, text);
    }

    private void renderPager(DrawContext context, TextRenderer font, int mouseX, int mouseY) {
        if (pageCount() <= 1) {
            return;
        }

        int pagerY = y + height - 12;
        int[] previous = pagerBox(false);
        int[] next = pagerBox(true);

        MenuTheme.centered(context, font, "<", previous[0], previous[2], pagerY,
            MenuTheme.inside(mouseX, mouseY, previous[0], previous[1], previous[2], 10)
                ? MenuTheme.ACCENT : MenuTheme.TEXT_DIM);
        MenuTheme.centered(context, font, ">", next[0], next[2], pagerY,
            MenuTheme.inside(mouseX, mouseY, next[0], next[1], next[2], 10)
                ? MenuTheme.ACCENT : MenuTheme.TEXT_DIM);
        MenuTheme.centered(context, font, (page + 1) + "/" + pageCount(),
            previous[0] + previous[2], 24, pagerY, MenuTheme.TEXT_DIM);
    }

    /** @return {x, y, largeur} d'une fleche de pagination. */
    private int[] pagerBox(boolean forward) {
        int arrowWidth = 12;
        int right = gridX() + gridWidth();
        int start = right - arrowWidth * 2 - 24;
        return new int[] {forward ? right - arrowWidth : start, y + height - 14, arrowWidth};
    }

    // --------------------------------------------------------- colonne droite

    private void renderPanel(DrawContext context, TextRenderer font, int mouseX, int mouseY) {
        MenuTheme.panelBottom(context, panelX(), contentY() + 1, PANEL_WIDTH - 1,
            y + height - 1 - (contentY() + 1), WINDOW_RADIUS - 1, 0x6B232532);
        context.fill(panelX(), contentY() + 1, panelX() + 1, y + height - 1, 0x22FFFFFF);

        if (options == null) {
            MenuTheme.text(context, font, "REGLAGES DU MOD",
                panelX() + PAD, contentY() + PAD, MenuTheme.TEXT_DIM);
            List<String> hint = MenuTheme.wrap(
                font, "Choisissez un module pour regler ce qu'il fait.", PANEL_WIDTH - PAD * 2, 3);
            for (int line = 0; line < hint.size(); line++) {
                MenuTheme.text(context, font, hint.get(line),
                    panelX() + PAD, contentY() + PAD + 14 + line * 10, MenuTheme.TEXT_DIM);
            }
            return;
        }

        renderOptions(context, font, panelX() + PAD, PANEL_WIDTH - PAD * 2,
            contentY() + PAD, mouseX, mouseY, false);
    }

    // ----------------------------------------------------------------- options

    /**
     * Une ligne de reglage, telle qu'elle sera dessinee puis cliquee.
     *
     * <p>Le dessin et le clic parcouraient chacun leur liste, en recalculant les
     * memes decalages a la main. Ils ne pouvaient rester d'accord que par
     * attention soutenue, et les hauteurs deviennent variables ici -- une ligne
     * ou deux selon la place. Une seule liste, construite une fois, et les deux
     * la lisent.
     *
     * @param setting le reglage du module, ou {@code null} pour une ligne propre
     *     a un element de HUD.
     */
    private record Row(Setting<?> setting, HudRow hud, String label, String value,
                       float fraction, boolean bar) {
    }

    /** Les lignes d'un element de HUD, qui ne sont pas des {@link Setting}. */
    private enum HudRow {
        OPACITE, TAILLE, FOND, OMBRE
    }

    private List<Row> rows(TextRenderer font, Module module) {
        List<Row> list = new ArrayList<>();
        for (Setting<?> setting : module.settings()) {
            list.add(rowOf(setting));
        }

        if (module instanceof HudElement hud) {
            list.add(new Row(null, HudRow.OPACITE, "Opacite",
                Math.round(hud.layout().opacity() * 100) + " %", hud.layout().opacity(), true));
            list.add(new Row(null, HudRow.TAILLE, "Taille",
                String.format("%.1fx", hud.layout().scale()),
                (hud.layout().scale() - 0.5f) / 2.5f, true));

            BackgroundStyle chosen = hud.layout().background();
            list.add(new Row(null, HudRow.FOND, "Fond", chosen == BackgroundStyle.AUTO
                ? chosen.label() + " (" + hud.resolvedShape().label() + ")"
                : chosen.label(), 0f, false));

            list.add(new Row(null, HudRow.OMBRE, "Ombre du texte", hud.textShadow()
                ? (hud.layout().textShadow() ? "Oui" : "Oui (sans fond)")
                : "Non", 0f, false));
        }
        return list;
    }

    private Row rowOf(Setting<?> setting) {
        if (setting instanceof BooleanSetting value) {
            return new Row(setting, null, setting.label(), value.get() ? "Oui" : "Non", 0f, false);
        }
        if (setting instanceof SliderSetting slider) {
            return new Row(setting, null, setting.label(), slider.display(),
                (float) slider.fraction(), true);
        }
        if (setting instanceof EnumSetting<?> choice) {
            return new Row(setting, null, setting.label(), choice.display(), 0f, false);
        }
        if (setting instanceof KeySetting key) {
            return new Row(setting, null, setting.label(), key.display(), 0f, false);
        }
        return new Row(setting, null, setting.label(), "", 0f, false);
    }

    /**
     * La place que prend la valeur a droite du libelle.
     *
     * <p>Un nuancier n'a pas de texte mais occupe quand meme sa largeur, et un
     * curseur a besoin de sa barre en plus de son chiffre. Sans ce compte, le
     * libelle d'un reglage de couleur s'ecrivait par-dessus le nuancier.
     */
    private int valueSlot(TextRenderer font, Row row) {
        if (row.setting() instanceof ColorSetting) {
            return SWATCH_WIDTH;
        }
        int value = font.getWidth(row.value());
        return row.bar() ? BAR_MIN + VALUE_GAP + value : value;
    }

    /**
     * Deux lignes plutot qu'une, des que les deux ne tiennent pas cote a cote.
     *
     * <p>La comparaison porte sur la largeur reelle du libelle, et non sur un
     * minimum arbitraire. La regle precedente ne regardait que la valeur: le
     * libelle, lui, etait tronque sans autre forme de proces, et la colonne
     * affichait trois fois « Couleur ... » pour trois reglages differents.
     *
     * <p>Une ligne coupee vaut mieux qu'un nom coupe: la hauteur, on l'a.
     */
    private boolean twoLines(TextRenderer font, Row row, int available) {
        return font.getWidth(row.label()) + VALUE_GAP + valueSlot(font, row) > available;
    }

    private int rowHeight(TextRenderer font, Row row, int available) {
        return twoLines(font, row, available) ? ROW_HEIGHT + 9 : ROW_HEIGHT;
    }

    /**
     * Les reglages du module choisi, dans la region qu'on lui donne.
     *
     * <p>La region est un parametre et non une propriete de la fenetre: le meme
     * code dessine la colonne de droite quand elle tient, et reprend la place de
     * la grille quand elle ne tient pas.
     */
    private void renderOptions(
        DrawContext context, TextRenderer font,
        int left, int available, int top, int mouseX, int mouseY, boolean withBack) {
        int rowY = top;

        if (withBack) {
            int[] back = backBox(font);
            MenuTheme.chip(context, font, "< RETOUR", back[0], back[1], back[2], CHIP_HEIGHT, false,
                MenuTheme.inside(mouseX, mouseY, back[0], back[1], back[2], CHIP_HEIGHT));
            MenuTheme.text(context, font, MenuTheme.fit(font, options.name(),
                available - back[2] - 12), back[0] + back[2] + 8, back[1] + 3, MenuTheme.ACCENT);
            rowY = back[1] + CHIP_HEIGHT + PAD;
        } else {
            MenuTheme.text(context, font, "REGLAGES DU MOD", left, rowY, MenuTheme.TEXT_DIM);
            rowY += 11;
            MenuTheme.text(context, font, MenuTheme.fit(font, options.name(), available),
                left, rowY, MenuTheme.ACCENT);
            rowY += 14;
        }

        for (Row row : rows(font, options)) {
            renderRow(context, font, row, left, available, rowY, mouseX, mouseY);
            rowY += rowHeight(font, row, available);
        }
    }

    private void renderRow(
        DrawContext context, TextRenderer font, Row row,
        int left, int available, int rowY, int mouseX, int mouseY) {
        int height = rowHeight(font, row, available);
        boolean split = twoLines(font, row, available);

        if (MenuTheme.inside(mouseX, mouseY, left, rowY, available, height)) {
            context.fill(left, rowY - 1, left + available, rowY + height - 2, MenuTheme.ROW_HOVER);
        }

        // Sur deux lignes, le libelle a toute la largeur -- sauf pour un curseur,
        // dont le chiffre reste sur la premiere ligne et seule la barre descend.
        int labelRoom = available;
        if (!split) {
            labelRoom -= VALUE_GAP + valueSlot(font, row);
        } else if (row.bar()) {
            labelRoom -= VALUE_GAP + font.getWidth(row.value());
        }
        MenuTheme.text(context, font, MenuTheme.fit(font, row.label(), Math.max(labelRoom, 8)),
            left + 2, rowY, MenuTheme.TEXT);

        if (row.setting() instanceof ColorSetting color) {
            int swatchY = split ? rowY + 10 : rowY + 1;
            int swatchX = left + available - SWATCH_WIDTH;
            MenuTheme.panel(context, swatchX, swatchY, SWATCH_WIDTH - 2, 7, 3, color.argb());
            MenuTheme.outline(context, swatchX, swatchY, SWATCH_WIDTH - 2, 7, 3, 0x60FFFFFF);
            return;
        }

        boolean waiting = row.setting() instanceof KeySetting key && key.waiting();
        int valueColor = waiting ? MenuTheme.TEXT : MenuTheme.ACCENT;

        if (row.bar()) {
            // Le chiffre dit la valeur, la barre dit la proportion: sans le
            // chiffre on voit qu'on a pousse le curseur aux deux tiers, mais pas
            // si cela fait quarante blocs ou soixante.
            MenuTheme.right(context, font, row.value(), left, available - 2, rowY, valueColor);
            int[] bar = barBox(font, row, left, available, rowY);
            context.fill(bar[0], bar[1], bar[0] + bar[2], bar[1] + 3, 0x50FFFFFF);
            int filled = Math.round(bar[2] * Math.min(Math.max(row.fraction(), 0f), 1f));
            context.fill(bar[0], bar[1], bar[0] + filled, bar[1] + 3, MenuTheme.ACCENT);
            return;
        }

        int valueY = split ? rowY + 9 : rowY;
        MenuTheme.right(context, font, MenuTheme.fit(font, row.value(), available - 4),
            left, available - 2, valueY, valueColor);
    }

    /** @return {x, y, largeur} de la barre d'une ligne a curseur. */
    private int[] barBox(TextRenderer font, Row row, int left, int available, int rowY) {
        if (twoLines(font, row, available)) {
            return new int[] {left + 2, rowY + 12, available - 4};
        }
        int taken = font.getWidth(row.label()) + VALUE_GAP * 2 + font.getWidth(row.value());
        int width = clamp(available - taken - 4, BAR_MIN, BAR_MAX);
        return new int[] {
            left + available - 2 - font.getWidth(row.value()) - VALUE_GAP - width,
            rowY + 3,
            width,
        };
    }

    /**
     * Ou commence la premiere rangee de reglages, dans la region qui les porte.
     *
     * <p>Doit rester d'accord avec {@link #renderOptions}, qui avance du meme
     * nombre de pixels apres son en-tete: la colonne de droite ecrit un kicker
     * puis le nom du module, la vue etroite un bouton de retour.
     */
    private int optionsTop() {
        return panelVisible() ? contentY() + PAD + 25 : gridY() + CHIP_HEIGHT + PAD;
    }

    private int optionsLeft() {
        return panelVisible() ? panelX() + PAD : gridX();
    }

    private int optionsWidth() {
        return panelVisible() ? PANEL_WIDTH - PAD * 2 : gridWidth();
    }

    private int[] backBox(TextRenderer font) {
        return new int[] {gridX(), gridY(), font.getWidth("< RETOUR") + 14};
    }

    // ------------------------------------------------------------- reglages

    private void renderReglages(DrawContext context, TextRenderer font) {
        int rowY = gridY() + 2;
        int left = gridX();
        int available = panelVisible() ? panelX() - PAD - left : gridWidth();

        MenuTheme.text(context, font, "Touche d'ouverture", left, rowY, MenuTheme.TEXT);
        MenuTheme.right(context, font, "Maj droite", left, available, rowY, MenuTheme.ACCENT);
        rowY += ROW_HEIGHT + 2;

        MenuTheme.text(context, font, "Minecraft", left, rowY, MenuTheme.TEXT);
        MenuTheme.right(context, font, Platforms.get().minecraftVersion(),
            left, available, rowY, MenuTheme.ACCENT);
        rowY += ROW_HEIGHT + 2;

        MenuTheme.text(context, font, "Modules", left, rowY, MenuTheme.TEXT);
        MenuTheme.right(context, font, registry.all().size() + " dont " + activeCount() + " actifs",
            left, available, rowY, MenuTheme.ACCENT);
        rowY += ROW_HEIGHT + 6;

        for (String line : MenuTheme.wrap(font,
            "Les modules grises sont interdits par le serveur sur lequel vous jouez. "
                + "Ils redeviennent disponibles ailleurs.", available, 4)) {
            MenuTheme.text(context, font, line, left, rowY, MenuTheme.TEXT_DIM);
            rowY += ROW_HEIGHT;
        }
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

        List<ModuleCategory> categories = filters();
        for (int index = 0; index < categories.size(); index++) {
            int[] box = railBox(index);
            if (MenuTheme.inside(mouseX, mouseY, box[0], box[1], box[2], RAIL_ROW)) {
                filter = categories.get(index);
                page = 0;
                return false;
            }
        }

        if (tab != Tab.MODULES) {
            return false;
        }

        // Etroite, reglages ouverts: la grille n'est pas dessinee, seuls les
        // reglages recoivent les clics.
        if (options != null && !panelVisible()) {
            handleOptionsClick(font, mouseX, mouseY, button);
            return false;
        }

        if (handleCardsClick(mouseX, mouseY)) {
            return false;
        }

        if (options != null && panelVisible()) {
            handleOptionsClick(font, mouseX, mouseY, button);
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
    public boolean pollCloseRequest() {
        boolean requested = closeRequested;
        closeRequested = false;
        return requested;
    }

    /** @return true si le clic a ete consomme par la grille. */
    private boolean handleCardsClick(int mouseX, int mouseY) {
        if (pageCount() > 1) {
            int[] previous = pagerBox(false);
            int[] next = pagerBox(true);
            if (MenuTheme.inside(mouseX, mouseY, previous[0], previous[1], previous[2], 10)) {
                page = Math.max(0, page - 1);
                return true;
            }
            if (MenuTheme.inside(mouseX, mouseY, next[0], next[1], next[2], 10)) {
                page = Math.min(pageCount() - 1, page + 1);
                return true;
            }
        }

        List<Module> modules = visibleModules();
        int first = page * perPage();
        int last = Math.min(modules.size(), first + perPage());

        for (int index = first; index < last; index++) {
            int[] box = cardBox(index - first);
            if (!MenuTheme.inside(mouseX, mouseY, box[0], box[1], box[2], CARD_HEIGHT)) {
                continue;
            }

            Module module = modules.get(index);
            int[] toggle = toggleBox(box[0], box[1], box[2]);
            if (MenuTheme.inside(mouseX, mouseY, toggle[0], toggle[1], MenuTheme.toggleWidth(), 9)) {
                // Un module verrouille garde son interrupteur visible mais
                // inerte: la pastille dit deja pourquoi il ne repond pas.
                if (!module.lockedByServer()) {
                    module.setEnabled(!module.enabledByPlayer());
                    registry.save();
                }
                return true;
            }

            // Le reste de la carte choisit le module: ses reglages remplissent
            // la colonne de droite. Un second clic sur la carte choisie la
            // relache, pour retrouver l'invite.
            options = module == options ? null : module;
            return true;
        }
        return false;
    }

    /**
     * Le clic parcourt exactement la liste que le dessin a parcourue.
     *
     * <p>Les hauteurs de ligne varient -- une ou deux lignes selon la place --
     * donc les recalculer ici les ferait deriver a la premiere valeur un peu
     * longue, et le joueur reglerait la ligne d'a cote sans comprendre.
     */
    private void handleOptionsClick(TextRenderer font, int mouseX, int mouseY, int button) {
        if (!panelVisible()) {
            int[] back = backBox(font);
            if (MenuTheme.inside(mouseX, mouseY, back[0], back[1], back[2], CHIP_HEIGHT)) {
                options = null;
                registry.save();
                return;
            }
        }

        int left = optionsLeft();
        int available = optionsWidth();
        int rowY = optionsTop();

        // Clic droit: on parcourt les valeurs a l'envers. Indispensable pour les
        // listes a plus de deux choix, sinon il faut faire le tour complet.
        int direction = button == 1 ? -1 : 1;

        for (Row row : rows(font, options)) {
            int height = rowHeight(font, row, available);
            if (!MenuTheme.inside(mouseX, mouseY, left, rowY, available, height)) {
                rowY += height;
                continue;
            }

            double fraction = 0.0;
            if (row.bar()) {
                int[] bar = barBox(font, row, left, available, rowY);
                fraction = Math.min(Math.max((mouseX - bar[0]) / (double) bar[2], 0.0), 1.0);
            }
            apply(row, fraction, direction);
            registry.save();
            return;
        }
    }

    private void apply(Row row, double fraction, int direction) {
        if (row.setting() != null) {
            applySetting(row.setting(), fraction, direction);
            return;
        }

        if (!(options instanceof HudElement hud)) {
            return;
        }

        switch (row.hud()) {
            case OPACITE -> hud.layout().setOpacity((float) fraction);
            case TAILLE -> hud.layout().setScale(0.5f + (float) fraction * 2.5f);
            case FOND -> {
                BackgroundStyle[] styles = BackgroundStyle.values();
                int next = hud.layout().background().ordinal() + direction;
                hud.layout().setBackground(
                    styles[((next % styles.length) + styles.length) % styles.length]);
            }
            case OMBRE -> hud.layout().setTextShadow(!hud.layout().textShadow());
        }
    }

    private void applySetting(Setting<?> setting, double fraction, int direction) {
        if (setting instanceof BooleanSetting value) {
            value.toggle();
        } else if (setting instanceof SliderSetting slider) {
            slider.setFraction(fraction);
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
                0xFFFFFFFF, 0xFF9184D9, 0xFFB5ABFC, 0xFF7CD8FF, 0xFF7CFF9E, 0xFFFFE07C, 0xFFFF7C7C,
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
}

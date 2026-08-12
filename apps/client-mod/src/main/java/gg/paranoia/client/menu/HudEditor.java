package gg.paranoia.client.menu;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.hud.HudRegistry;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;

import java.util.ArrayList;
import java.util.List;

/**
 * Mode placement des HUD: la fenetre s'efface, les elements se prennent a la
 * souris et s'aimantent aux bords et entre eux.
 *
 * <p>Il fallait un mode a part. Tant que la fenetre couvrait la moitie de
 * l'ecran, on placait ses HUD sans voir ce qu'on faisait -- c'est aussi pour ca
 * que Lunar en fait un bouton separe.
 */
public final class HudEditor {
    /** Distance en pixels sous laquelle un bord s'aimante. */
    private static final int SNAP_DISTANCE = 5;

    private static final int BAR_HEIGHT = 22;
    private static final int BUTTON_WIDTH = 74;

    private final HudRegistry registry;

    private HudElement dragged;
    private HudElement selected;
    private int grabX;
    private int grabY;

    // Reperes d'alignement, recalcules a chaque image de deplacement.
    private final List<Integer> guidesX = new ArrayList<>();
    private final List<Integer> guidesY = new ArrayList<>();

    public HudEditor(HudRegistry registry) {
        this.registry = registry;
    }

    public HudElement selected() {
        return selected;
    }

    public void reset() {
        dragged = null;
        selected = null;
        guidesX.clear();
        guidesY.clear();
    }

    // ------------------------------------------------------------------ rendu

    public void render(
        DrawContext context, TextRenderer font, int width, int height, int mouseX, int mouseY) {
        if (dragged != null) {
            updateDrag(font, width, height, mouseX, mouseY);
        }

        for (HudElement element : registry.hudElements()) {
            if (!element.enabledByPlayer()) {
                continue;
            }

            HudRegistry.draw(context, font, element, width, height);

            int[] box = HudRegistry.bounds(element, font, width, height);
            boolean active = element == dragged || element == selected;
            boolean hovered = MenuTheme.inside(mouseX, mouseY, box[0], box[1], box[2], box[3]);
            MenuTheme.outline(context, box[0] - 1, box[1] - 1, box[2] + 2, box[3] + 2,
                active ? MenuTheme.ACCENT : (hovered ? 0x88FFFFFF : 0x33FFFFFF));
        }

        for (int x : guidesX) {
            context.fill(x, 0, x + 1, height, MenuTheme.GUIDE);
        }
        for (int y : guidesY) {
            context.fill(0, y, width, y + 1, MenuTheme.GUIDE);
        }

        renderBar(context, font, width, height, mouseX, mouseY);
    }

    private void renderBar(
        DrawContext context, TextRenderer font, int width, int height, int mouseX, int mouseY) {
        int y = height - BAR_HEIGHT;
        context.fill(0, y, width, height, 0xE00E0E13);
        context.fill(0, y, width, y + 1, MenuTheme.ACCENT_DIM);

        String hint = selected == null
            ? "Glissez un HUD pour le deplacer. Clic droit: ses reglages."
            : "Deplacement de " + selected.name();
        MenuTheme.text(context, font, hint, 8, y + (BAR_HEIGHT - font.fontHeight) / 2, MenuTheme.TEXT_DIM);

        drawBarButton(context, font, "TERMINE", doneX(width), y, mouseX, mouseY);
        drawBarButton(context, font, "CENTRER", resetX(width), y, mouseX, mouseY);
    }

    private void drawBarButton(
        DrawContext context, TextRenderer font, String label, int x, int barY, int mouseX, int mouseY) {
        int y = barY + 4;
        int height = BAR_HEIGHT - 8;
        boolean hovered = MenuTheme.inside(mouseX, mouseY, x, y, BUTTON_WIDTH, height);

        MenuTheme.panel(context, x, y, BUTTON_WIDTH, height,
            hovered ? MenuTheme.CARD_HOVER : MenuTheme.CARD);
        MenuTheme.outline(context, x, y, BUTTON_WIDTH, height, MenuTheme.ACCENT_DIM);
        MenuTheme.centered(context, font, label, x, BUTTON_WIDTH,
            y + (height - font.fontHeight) / 2, MenuTheme.ACCENT);
    }

    private static int doneX(int width) {
        return width - BUTTON_WIDTH - 8;
    }

    private static int resetX(int width) {
        return width - BUTTON_WIDTH * 2 - 14;
    }

    // ----------------------------------------------------------------- souris

    /** @return true si le clic ferme le mode edition. */
    public boolean mouseClicked(
        TextRenderer font, int width, int height, int mouseX, int mouseY, int button) {
        int barY = height - BAR_HEIGHT + 4;
        int barHeight = BAR_HEIGHT - 8;

        if (MenuTheme.inside(mouseX, mouseY, doneX(width), barY, BUTTON_WIDTH, barHeight)) {
            registry.save();
            return true;
        }

        if (MenuTheme.inside(mouseX, mouseY, resetX(width), barY, BUTTON_WIDTH, barHeight)) {
            // Remet au centre l'element selectionne, ou tous si aucun ne l'est:
            // c'est la sortie de secours quand un HUD a fini hors de l'ecran.
            for (HudElement element : registry.hudElements()) {
                if (selected == null || element == selected) {
                    element.placeAt(0.5, 0.5);
                }
            }
            registry.save();
            return false;
        }

        List<HudElement> elements = registry.hudElements();
        // Du dernier au premier: l'element dessine par-dessus se saisit d'abord.
        for (int i = elements.size() - 1; i >= 0; i--) {
            HudElement element = elements.get(i);
            if (!element.enabledByPlayer()) {
                continue;
            }

            int[] box = HudRegistry.bounds(element, font, width, height);
            if (!MenuTheme.inside(mouseX, mouseY, box[0], box[1], box[2], box[3])) {
                continue;
            }

            selected = element;
            if (button == 0) {
                dragged = element;
                grabX = mouseX - box[0];
                grabY = mouseY - box[1];
            }
            return false;
        }

        selected = null;
        return false;
    }

    public boolean mouseReleased() {
        if (dragged == null) {
            return false;
        }

        dragged = null;
        guidesX.clear();
        guidesY.clear();
        registry.save();
        return true;
    }

    // -------------------------------------------------------------- placement

    private void updateDrag(TextRenderer font, int width, int height, int mouseX, int mouseY) {
        int[] box = HudRegistry.bounds(dragged, font, width, height);
        int elementWidth = box[2];
        int elementHeight = box[3];

        int x = mouseX - grabX;
        int y = mouseY - grabY;

        guidesX.clear();
        guidesY.clear();
        x = snap(x, elementWidth, true, font, width, height);
        y = snap(y, elementHeight, false, font, width, height);

        float scale = dragged.layout().scale();
        // La position est stockee dans l'espace mis a l'echelle, comme au rendu.
        dragged.layout().moveTo(
            Math.round(x / scale), Math.round(y / scale),
            (int) (width / scale), (int) (height / scale),
            Math.round(elementWidth / scale), Math.round(elementHeight / scale));
    }

    /**
     * Aimante un bord, le centre ou le bord oppose de l'element.
     *
     * <p>Les cibles sont les bords de l'ecran, son milieu, et les bords des
     * autres HUD: c'est ce qui permet d'aligner deux panneaux sans les regler
     * au pixel.
     */
    private int snap(
        int position, int size, boolean horizontal,
        TextRenderer font, int width, int height) {
        int screen = horizontal ? width : height;
        List<Integer> targets = new ArrayList<>(List.of(0, screen / 2, screen));

        for (HudElement other : registry.hudElements()) {
            if (other == dragged || !other.enabledByPlayer()) {
                continue;
            }
            int[] box = HudRegistry.bounds(other, font, width, height);
            int start = horizontal ? box[0] : box[1];
            int extent = horizontal ? box[2] : box[3];
            targets.add(start);
            targets.add(start + extent);
        }

        List<Integer> guides = horizontal ? guidesX : guidesY;
        for (int target : targets) {
            if (Math.abs(position - target) <= SNAP_DISTANCE) {
                guides.add(target);
                return target;
            }
            if (Math.abs(position + size - target) <= SNAP_DISTANCE) {
                guides.add(target);
                return target - size;
            }
            if (Math.abs(position + size / 2 - target) <= SNAP_DISTANCE) {
                guides.add(target);
                return target - size / 2;
            }
        }
        return position;
    }
}

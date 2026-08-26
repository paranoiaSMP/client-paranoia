package gg.paranoia.client.hud.elements;

import gg.paranoia.client.hud.HudElement;
import gg.paranoia.client.module.BooleanSetting;
import gg.paranoia.client.module.EnumSetting;
import net.minecraft.client.font.TextRenderer;
import net.minecraft.client.gui.DrawContext;
import net.minecraft.client.network.ClientPlayerEntity;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.item.ItemStack;

import java.util.ArrayList;
import java.util.List;

/** Les quatre pieces d'armure et la main, avec leur durabilite. */
public final class ArmorHud extends HudElement {
    public enum Orientation {
        HORIZONTAL("Horizontal"),
        VERTICAL("Vertical");

        private final String label;

        Orientation(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    /** Ce qu'on lit sous chaque piece. */
    public enum Durability {
        POINTS("Points restants"),
        POURCENTAGE("Pourcentage");

        private final String label;

        Durability(String label) {
            this.label = label;
        }

        public String label() {
            return label;
        }
    }

    private static final int ICON = 16;
    private static final int SPACING = 4;

    private final EnumSetting<Orientation> orientation = add(new EnumSetting<>(
        "orientation", "Disposition", Orientation.HORIZONTAL, Orientation.values(), Orientation::label));
    private final BooleanSetting showHand =
        add(new BooleanSetting("hand", "Inclure la main", true));
    private final BooleanSetting showDurability =
        add(new BooleanSetting("durability", "Durabilite restante", true));
    /**
     * Points restants par defaut.
     *
     * <p>C'est le chiffre qu'on regarde en combat: un pourcentage ne dit pas
     * combien de coups il reste, alors que le nombre brut, si.
     */
    private final EnumSetting<Durability> durabilityFormat = add(new EnumSetting<>(
        "durabilityFormat", "Affichage", Durability.POINTS, Durability.values(), Durability::label));
    private final BooleanSetting hideEmpty =
        add(new BooleanSetting("hideEmpty", "Masquer les emplacements vides", true));

    public ArmorHud() {
        super("armor", "Armure", true);
        placeAt(0.5, 0.88);
    }

    @Override
    public boolean visibleInGame() {
        return client() != null && client().player != null && count > 0;
    }

    /** Du casque aux bottes, puis la main. */
    private static final EquipmentSlot[] ARMOR_SLOTS = {
        EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET,
    };

    /**
     * Une case affichee, reutilisee d'une image a l'autre.
     *
     * <p>La durabilite d'une piece ne bouge qu'a l'usage, soit quelques fois
     * par minute en combat: la reformater a chaque image reviendrait a jeter
     * des milliers de chaines par seconde pour afficher un nombre qui n'a pas
     * change.
     */
    private static final class Cell {
        ItemStack stack = ItemStack.EMPTY;
        String durability = "";
        int percent = 100;
        boolean damageable;

        int builtFrom = Integer.MIN_VALUE;
        int builtPercent = Integer.MIN_VALUE;
        Durability builtAs;
    }

    // Cinq au plus: quatre pieces d'armure et la main.
    private final List<Cell> pool = new ArrayList<>();
    private int count;

    /**
     * Releve les pieces a afficher.
     *
     * <p>On demande chaque piece par son emplacement d'equipement plutot que de
     * parcourir une liste de l'inventaire: le champ `armor` de PlayerInventory
     * n'existe plus, alors que getEquippedStack(EquipmentSlot) dit ce qu'on veut
     * et ne depend pas de l'ordre interne des emplacements.
     */
    @Override
    protected void refresh() {
        count = 0;

        ClientPlayerEntity player = client() == null ? null : client().player;
        if (player == null) {
            return;
        }

        boolean keepEmpty = !hideEmpty.get();

        for (EquipmentSlot slot : ARMOR_SLOTS) {
            ItemStack stack = player.getEquippedStack(slot);
            if (!stack.isEmpty() || keepEmpty) {
                take(stack);
            }
        }

        if (showHand.get()) {
            ItemStack held = player.getMainHandStack();
            if (!held.isEmpty() || keepEmpty) {
                take(held);
            }
        }
    }

    private void take(ItemStack stack) {
        while (pool.size() <= count) {
            pool.add(new Cell());
        }
        Cell cell = pool.get(count++);
        cell.stack = stack;
        cell.damageable = !stack.isEmpty() && stack.isDamageable();

        if (!cell.damageable) {
            cell.durability = "";
            cell.builtFrom = Integer.MIN_VALUE;
            return;
        }

        int max = stack.getMaxDamage();
        int remaining = max - stack.getDamage();
        cell.percent = max > 0 ? remaining * 100 / max : 100;

        // Les deux nombres comptent, pas seulement celui qu'on affiche: une
        // case reprise par une autre piece peut avoir la meme durabilite
        // restante et un pourcentage different, ou l'inverse.
        Durability format = durabilityFormat.get();
        if (remaining == cell.builtFrom && cell.percent == cell.builtPercent && format == cell.builtAs) {
            return;
        }

        cell.builtFrom = remaining;
        cell.builtPercent = cell.percent;
        cell.builtAs = format;
        cell.durability =
            format == Durability.POINTS ? String.valueOf(remaining) : cell.percent + "%";
    }

    /** Largeur du plus long texte de durabilite affiche. */
    private int durabilityWidth(TextRenderer textRenderer) {
        int widest = 0;
        for (int index = 0; index < count; index++) {
            Cell cell = pool.get(index);
            if (cell.damageable) {
                widest = Math.max(widest, textRenderer.getWidth(cell.durability));
            }
        }
        return widest;
    }

    private int cellHeight(TextRenderer textRenderer) {
        return showDurability.get() ? ICON + textRenderer.fontHeight + 1 : ICON;
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int cells = Math.max(1, count);
        if (orientation.get() == Orientation.HORIZONTAL) {
            return cells * ICON + (cells - 1) * SPACING + PADDING * 2;
        }
        return ICON + PADDING * 2 + (showDurability.get() ? 6 + durabilityWidth(textRenderer) : 0);
    }

    @Override
    public int height(TextRenderer textRenderer) {
        int cells = Math.max(1, count);
        if (orientation.get() == Orientation.HORIZONTAL) {
            return cellHeight(textRenderer) + PADDING * 2;
        }
        return cells * (ICON + SPACING) - SPACING + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        boolean horizontal = orientation.get() == Orientation.HORIZONTAL;
        boolean durability = showDurability.get();

        for (int i = 0; i < count; i++) {
            Cell cell = pool.get(i);
            int slotX = horizontal ? x + i * (ICON + SPACING) : x;
            int slotY = horizontal ? y : y + i * (ICON + SPACING);

            if (cell.stack.isEmpty()) {
                // Emplacement vide affiche: un cadre discret vaut mieux qu'un
                // trou, sinon les pieces sautent d'une position a l'autre.
                drawSlotOutline(context, slotX, slotY);
                continue;
            }

            context.drawItem(cell.stack, slotX, slotY);

            if (!durability || !cell.damageable) {
                continue;
            }

            int color = durabilityColor(cell.percent);
            if (horizontal) {
                int textX = slotX + (ICON - textRenderer.getWidth(cell.durability)) / 2;
                drawLine(context, textRenderer, cell.durability, textX, slotY + ICON + 1, color);
            } else {
                drawLine(context, textRenderer, cell.durability, slotX + ICON + 4,
                    slotY + (ICON - textRenderer.fontHeight) / 2, color);
            }
        }
    }

    private void drawSlotOutline(DrawContext context, int x, int y) {
        int color = textColor(0x40FFFFFF);
        context.fill(x, y, x + ICON, y + 1, color);
        context.fill(x, y + ICON - 1, x + ICON, y + ICON, color);
        context.fill(x, y + 1, x + 1, y + ICON - 1, color);
        context.fill(x + ICON - 1, y + 1, x + ICON, y + ICON - 1, color);
    }

    /** Vert, orange puis rouge: lisible d'un coup d'oeil en combat. */
    private static int durabilityColor(int percent) {
        if (percent > 50) {
            return 0x7CFF9E;
        }
        return percent > 20 ? 0xFFE07C : 0xFF7C7C;
    }
}

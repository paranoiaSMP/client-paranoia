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

    private static final int ICON = 16;
    private static final int SPACING = 4;

    private final EnumSetting<Orientation> orientation = add(new EnumSetting<>(
        "orientation", "Disposition", Orientation.HORIZONTAL, Orientation.values(), Orientation::label));
    private final BooleanSetting showHand =
        add(new BooleanSetting("hand", "Inclure la main", true));
    private final BooleanSetting showDurability =
        add(new BooleanSetting("durability", "Durabilite restante", true));
    private final BooleanSetting hideEmpty =
        add(new BooleanSetting("hideEmpty", "Masquer les emplacements vides", true));

    public ArmorHud() {
        super("armor", "Armure", true);
        placeAt(0.5, 0.88);
    }

    @Override
    public boolean visibleInGame() {
        return client() != null && client().player != null && !slots().isEmpty();
    }

    /** Du casque aux bottes, puis la main. */
    private static final EquipmentSlot[] ARMOR_SLOTS = {
        EquipmentSlot.HEAD, EquipmentSlot.CHEST, EquipmentSlot.LEGS, EquipmentSlot.FEET,
    };

    /**
     * Pieces a afficher.
     *
     * <p>On demande chaque piece par son emplacement d'equipement plutot que de
     * parcourir une liste de l'inventaire: le champ `armor` de PlayerInventory
     * n'existe plus, alors que getEquippedStack(EquipmentSlot) dit ce qu'on veut
     * et ne depend pas de l'ordre interne des emplacements.
     */
    private List<ItemStack> slots() {
        List<ItemStack> stacks = new ArrayList<>();
        ClientPlayerEntity player = client() != null ? client().player : null;
        if (player == null) {
            return stacks;
        }

        for (EquipmentSlot slot : ARMOR_SLOTS) {
            ItemStack stack = player.getEquippedStack(slot);
            if (!stack.isEmpty() || !hideEmpty.get()) {
                stacks.add(stack);
            }
        }

        if (showHand.get()) {
            ItemStack held = player.getMainHandStack();
            if (!held.isEmpty() || !hideEmpty.get()) {
                stacks.add(held);
            }
        }

        return stacks;
    }

    private int cellHeight(TextRenderer textRenderer) {
        return showDurability.get() ? ICON + textRenderer.fontHeight + 1 : ICON;
    }

    @Override
    public int width(TextRenderer textRenderer) {
        int count = Math.max(1, slots().size());
        if (orientation.get() == Orientation.HORIZONTAL) {
            return count * ICON + (count - 1) * SPACING + PADDING * 2;
        }
        return ICON + PADDING * 2 + (showDurability.get() ? 22 : 0);
    }

    @Override
    public int height(TextRenderer textRenderer) {
        int count = Math.max(1, slots().size());
        if (orientation.get() == Orientation.HORIZONTAL) {
            return cellHeight(textRenderer) + PADDING * 2;
        }
        return count * (ICON + SPACING) - SPACING + PADDING * 2;
    }

    @Override
    public void renderContent(DrawContext context, TextRenderer textRenderer, int x, int y) {
        List<ItemStack> stacks = slots();

        for (int i = 0; i < stacks.size(); i++) {
            ItemStack stack = stacks.get(i);
            int slotX = orientation.get() == Orientation.HORIZONTAL ? x + i * (ICON + SPACING) : x;
            int slotY = orientation.get() == Orientation.HORIZONTAL ? y : y + i * (ICON + SPACING);

            if (stack.isEmpty()) {
                // Emplacement vide affiche: un cadre discret vaut mieux qu'un
                // trou, sinon les pieces sautent d'une position a l'autre.
                drawSlotOutline(context, slotX, slotY);
                continue;
            }

            context.drawItem(stack, slotX, slotY);

            if (!showDurability.get() || !stack.isDamageable()) {
                continue;
            }

            int remaining = stack.getMaxDamage() - stack.getDamage();
            int percent = stack.getMaxDamage() > 0 ? remaining * 100 / stack.getMaxDamage() : 100;
            String text = percent + "%";

            if (orientation.get() == Orientation.HORIZONTAL) {
                int textX = slotX + (ICON - textRenderer.getWidth(text)) / 2;
                drawLine(context, textRenderer, text, textX, slotY + ICON + 1, durabilityColor(percent));
            } else {
                drawLine(context, textRenderer, text, slotX + ICON + 4,
                    slotY + (ICON - textRenderer.fontHeight) / 2, durabilityColor(percent));
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

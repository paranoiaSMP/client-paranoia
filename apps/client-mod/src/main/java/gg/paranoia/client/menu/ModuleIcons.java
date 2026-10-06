package gg.paranoia.client.menu;

import net.minecraft.client.gui.DrawContext;

import java.util.Map;

/**
 * Icones des cartes du menu, en pixel art.
 *
 * <p>Charger des textures demanderait des PNG dans le jar, un identifiant de
 * ressource et une primitive de dessin dont la signature bouge d'une version a
 * l'autre. Une grille de 9x9 dessinee au {@code fill} n'a aucun de ces
 * inconvenients, et un rendu pixelise est de toute facon ce qu'on veut ici.
 */
public final class ModuleIcons {
    private static final String[] FALLBACK = {
        "..#####..",
        ".#.....#.",
        "#.....#.#",
        "#....#..#",
        "#...#...#",
        "#.......#",
        "#...#...#",
        ".#.....#.",
        "..#####..",
    };

    /** Une entree par identifiant de module; voir {@code Module.id()}. */
    private static final Map<String, String[]> ICONS = Map.ofEntries(
        Map.entry("coordinates", new String[] {
            ".........",
            "######...",
            ".........",
            "########.",
            ".........",
            "####.....",
            ".........",
            "#######..",
            ".........",
        }),
        Map.entry("direction", new String[] {
            "....#....",
            "...###...",
            "..#####..",
            ".#######.",
            "....#....",
            "....#....",
            "....#....",
            "....#....",
            "....#....",
        }),
        Map.entry("armor", new String[] {
            ".#######.",
            ".#######.",
            ".#######.",
            ".#######.",
            "..#####..",
            "..#####..",
            "...###...",
            "....#....",
            ".........",
        }),
        Map.entry("info", new String[] {
            "..#####..",
            ".#.....#.",
            "#...#...#",
            "#.......#",
            "#...#...#",
            "#...#...#",
            "#...#...#",
            ".#.....#.",
            "..#####..",
        }),
        Map.entry("brightness", new String[] {
            "....#....",
            ".#.....#.",
            "..#####..",
            ".#######.",
            "#.#####.#",
            ".#######.",
            "..#####..",
            ".#.....#.",
            "....#....",
        }),
        Map.entry("colorhit", new String[] {
            "....#....",
            "....#....",
            "...###...",
            "..#####..",
            ".#######.",
            ".#######.",
            "..#####..",
            "...###...",
            ".........",
        }),
        Map.entry("crosshair", new String[] {
            "....#....",
            "....#....",
            "....#....",
            ".........",
            "###...###",
            ".........",
            "....#....",
            "....#....",
            "....#....",
        }),
        Map.entry("hitindicator", new String[] {
            "##.....##",
            "#.......#",
            ".........",
            ".........",
            "....#....",
            ".........",
            ".........",
            "#.......#",
            "##.....##",
        }),
        Map.entry("cps", new String[] {
            "..#####..",
            ".##...##.",
            ".##...##.",
            ".#######.",
            ".#######.",
            ".#######.",
            ".#######.",
            "..#####..",
            ".........",
        }),
        Map.entry("fps", new String[] {
            ".........",
            ".......##",
            ".......##",
            "....##.##",
            "....##.##",
            ".##.##.##",
            ".##.##.##",
            ".##.##.##",
            "#########",
        }),
        Map.entry("effects", new String[] {
            "...###...",
            "...#.#...",
            "...#.#...",
            "..#####..",
            ".#######.",
            ".#######.",
            ".#######.",
            "..#####..",
            ".........",
        }));

    private ModuleIcons() {
    }

    /**
     * Dessine l'icone d'un module, coin superieur gauche en (x, y).
     *
     * @param pixel taille d'un pixel de la grille; l'icone occupe 9 fois ca.
     */
    public static void draw(DrawContext context, String moduleId, int x, int y, int pixel, int color) {
        String[] rows = ICONS.getOrDefault(moduleId, FALLBACK);

        for (int row = 0; row < rows.length; row++) {
            String line = rows[row];
            for (int column = 0; column < line.length(); column++) {
                if (line.charAt(column) != '#') {
                    continue;
                }
                int left = x + column * pixel;
                int top = y + row * pixel;
                context.fill(left, top, left + pixel, top + pixel, color);
            }
        }
    }

    /** Cote de l'icone dessinee, en pixels d'ecran. */
    public static int size(int pixel) {
        return 9 * pixel;
    }
}

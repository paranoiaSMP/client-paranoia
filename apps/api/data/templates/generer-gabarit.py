"""Genere les gabarits de cape Paranoia.

Pas de PIL dans cet environnement, et pas besoin: un PNG sans filtre ni
palette tient en une vingtaine de lignes -- un en-tete, les donnees
compressees par zlib, trois blocs CRC. Ecrire l'encodeur coute moins cher
que de faire dependre le livrable d'un paquet absent.
"""

import struct
import zlib

# Le modele de cape est une boite 10 x 16 x 1, deballee sur une texture
# 64 x 32. Chaque face occupe une region fixe: c'est ce decoupage qu'on
# donne au dessinateur, sinon il peint 64 x 32 pixels au hasard dont
# seuls quelques-uns sont visibles en jeu.
REGIONS = [
    # (x, y, largeur, hauteur, couleur RGBA, nom)
    (1, 1, 10, 16, (124, 63, 212, 255), "EXTERIEUR"),   # la face qu'on voit
    (12, 1, 10, 16, (86, 44, 148, 255), "interieur"),   # doublure
    (1, 0, 10, 1, (58, 30, 100, 255), "haut"),
    (11, 0, 10, 1, (58, 30, 100, 255), "bas"),
    (0, 1, 1, 16, (40, 21, 69, 255), "bord g"),
    (11, 1, 1, 16, (40, 21, 69, 255), "bord d"),
]

WIDTH, HEIGHT = 64, 32
UNUSED = (24, 21, 32, 255)      # zone que le jeu ne lit jamais
TRANSPARENT = (0, 0, 0, 0)


def png(width, height, pixels):
    """Encode une image RGBA en PNG (couleur type 6, 8 bits)."""

    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filtre "None" sur chaque ligne
        for x in range(width):
            raw.extend(pixels[y][x])

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def build(marked):
    """Construit la grille de pixels.

    :param marked: True pour le gabarit colore, False pour la base vierge
        ou seules les zones utiles sont opaques.
    """
    grid = [[UNUSED if marked else TRANSPARENT for _ in range(WIDTH)] for _ in range(HEIGHT)]

    for x0, y0, w, h, color, _ in REGIONS:
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                # Sur la base vierge on laisse du blanc opaque: le
                # dessinateur voit ou peindre sans qu'une couleur vive
                # fausse sa perception des teintes.
                grid[y][x] = color if marked else (255, 255, 255, 255)

    return grid


def scale(grid, factor):
    """Agrandit au plus proche voisin, pour une version lisible a l'ecran."""
    return [
        [grid[y // factor][x // factor] for x in range(WIDTH * factor)]
        for y in range(HEIGHT * factor)
    ]


if __name__ == "__main__":
    import sys

    destination = sys.argv[1]

    guide = build(marked=True)
    with open(f"{destination}/cape-gabarit.png", "wb") as handle:
        handle.write(png(WIDTH, HEIGHT, guide))

    with open(f"{destination}/cape-gabarit-x8.png", "wb") as handle:
        handle.write(png(WIDTH * 8, HEIGHT * 8, scale(guide, 8)))

    with open(f"{destination}/cape-vierge.png", "wb") as handle:
        handle.write(png(WIDTH, HEIGHT, build(marked=False)))

    print("cape-gabarit.png      64x32   zones colorees")
    print("cape-gabarit-x8.png   512x256 meme chose, lisible a l'ecran")
    print("cape-vierge.png       64x32   zones utiles en blanc, reste transparent")

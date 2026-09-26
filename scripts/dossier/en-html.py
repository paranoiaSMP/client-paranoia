#!/usr/bin/env python3
"""Convertit le dossier Markdown en HTML fait pour etre COLLE dans Google Docs.

Volontairement limite aux constructions reellement presentes dans le dossier --
titres 1 a 4, tableaux, blocs de code clotures, listes a puces et numerotees,
citations, filets, gras, italique, code en ligne. Un convertisseur general
n'apporterait rien ici et introduirait des cas non verifies.

Ce qui guide les choix de sortie: ce qui survit a un copier-coller vers Google
Docs. Les bordures de tableau sont posees sur chaque cellule et non par une
regle CSS globale, parce que Docs lit les styles de cellule et ignore une bonne
partie du reste; les couleurs restent claires, un fond sombre arriverait tel
quel dans le document.
"""
import html
import re
import sys

GRAS = re.compile(r"\*\*(.+?)\*\*")
ITAL = re.compile(r"(?<![\w*])\*([^*\n]+?)\*(?![\w*])")
CODE = re.compile(r"`([^`\n]+?)`")
LIEN = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def enligne(texte: str) -> str:
    """Le formatage de niveau caractere, apres echappement."""
    out = html.escape(texte, quote=False)
    # Le code en ligne d'abord: son contenu ne doit pas etre relu comme du gras.
    jetons = []

    def garde(m):
        jetons.append(m.group(1))
        return f"\x00{len(jetons) - 1}\x00"

    out = CODE.sub(garde, out)
    out = LIEN.sub(r'<a href="\2">\1</a>', out)
    out = GRAS.sub(r"<strong>\1</strong>", out)
    out = ITAL.sub(r"<em>\1</em>", out)

    def rends(m):
        return (
            '<code style="font-family:\'Courier New\',monospace;'
            'background:#f1f1f3;padding:0 2px;">'
            f"{jetons[int(m.group(1))]}</code>"
        )

    return re.sub(r"\x00(\d+)\x00", rends, out)


CELLULE = (
    "border:1px solid #c7c7cf;padding:5px 8px;vertical-align:top;"
)
ENTETE = CELLULE + "background:#eeeef2;font-weight:bold;text-align:left;"


def cellules(ligne: str):
    brut = ligne.strip()
    if brut.startswith("|"):
        brut = brut[1:]
    if brut.endswith("|"):
        brut = brut[:-1]
    return [c.strip() for c in brut.split("|")]


def est_separateur(ligne: str) -> bool:
    return bool(re.fullmatch(r"\|[\s:|-]+\|?", ligne.strip())) and "-" in ligne


def convertis(source: str) -> str:
    lignes = source.split("\n")
    sortie = []
    i = 0
    n = len(lignes)

    # Etat des listes: une pile serait inutile, le dossier n'imbrique pas.
    liste = None  # "ul" | "ol" | None
    item = None   # lignes de l'item en cours

    def ferme_item():
        nonlocal item
        if item is not None:
            sortie.append(f"<li>{enligne(' '.join(item))}</li>")
            item = None

    def ferme_liste():
        nonlocal liste
        ferme_item()
        if liste is not None:
            sortie.append(f"</{liste}>")
            liste = None

    while i < n:
        ligne = lignes[i]
        nu = ligne.strip()

        # --- bloc de code
        if nu.startswith("```"):
            ferme_liste()
            langue = nu[3:].strip()
            corps = []
            i += 1
            while i < n and not lignes[i].strip().startswith("```"):
                corps.append(lignes[i])
                i += 1
            i += 1  # la cloture
            texte = html.escape("\n".join(corps), quote=False)
            etiquette = (
                f'<div style="font-size:8pt;color:#6b6b76;margin:10px 0 -6px;">{langue}</div>'
                if langue
                else ""
            )
            sortie.append(
                etiquette
                + '<pre style="font-family:\'Courier New\',monospace;font-size:9pt;'
                "background:#f5f5f7;border:1px solid #e0e0e6;padding:8px 10px;"
                'white-space:pre-wrap;">' + texte + "</pre>"
            )
            continue

        # --- tableau
        if nu.startswith("|") and i + 1 < n and est_separateur(lignes[i + 1]):
            ferme_liste()
            entetes = cellules(nu)
            i += 2
            corps = []
            while i < n and lignes[i].strip().startswith("|"):
                corps.append(cellules(lignes[i]))
                i += 1
            morceaux = [
                '<table style="border-collapse:collapse;width:100%;margin:12px 0;'
                'font-size:10pt;"><thead><tr>'
            ]
            for tete in entetes:
                morceaux.append(f'<td style="{ENTETE}">{enligne(tete)}</td>')
            morceaux.append("</tr></thead><tbody>")
            for rangee in corps:
                morceaux.append("<tr>")
                # Une rangee plus courte que l'en-tete est completee: Docs
                # decale tout le tableau si le compte de cellules varie.
                for k in range(len(entetes)):
                    valeur = rangee[k] if k < len(rangee) else ""
                    morceaux.append(f'<td style="{CELLULE}">{enligne(valeur)}</td>')
                morceaux.append("</tr>")
            morceaux.append("</tbody></table>")
            sortie.append("".join(morceaux))
            continue

        # --- filet
        if re.fullmatch(r"-{3,}", nu):
            ferme_liste()
            sortie.append(
                '<hr style="border:none;border-top:1px solid #d5d5dd;margin:22px 0;">'
            )
            i += 1
            continue

        # --- titre
        titre = re.match(r"(#{1,6})\s+(.*)", nu)
        if titre:
            ferme_liste()
            niveau = len(titre.group(1))
            tailles = {1: "20pt", 2: "15pt", 3: "12.5pt", 4: "11pt"}
            marges = {1: "26px 0 10px", 2: "22px 0 8px", 3: "18px 0 6px", 4: "14px 0 4px"}
            sortie.append(
                f'<h{niveau} style="font-size:{tailles.get(niveau, "11pt")};'
                f'margin:{marges.get(niveau, "12px 0 4px")};line-height:1.25;">'
                f"{enligne(titre.group(2))}</h{niveau}>"
            )
            i += 1
            continue

        # --- citation
        if nu.startswith(">"):
            ferme_liste()
            corps = []
            while i < n and lignes[i].strip().startswith(">"):
                corps.append(lignes[i].strip()[1:].strip())
                i += 1
            sortie.append(
                '<blockquote style="margin:14px 0;padding:8px 14px;'
                'border-left:3px solid #7c6cf0;background:#f6f5ff;">'
                f"{enligne(' '.join(corps))}</blockquote>"
            )
            continue

        # --- listes
        puce = re.match(r"-\s+(.*)", nu)
        numero = re.match(r"(\d+)\.\s+(.*)", nu)
        if puce or numero:
            voulue = "ul" if puce else "ol"
            if liste != voulue:
                ferme_liste()
                liste = voulue
                sortie.append(f'<{voulue} style="margin:8px 0 8px 18px;">')
            else:
                ferme_item()
            item = [puce.group(1) if puce else numero.group(2)]
            i += 1
            continue

        # Suite d'un item: ligne indentee, ou simple retour a la ligne souple
        # sous un item en cours.
        if item is not None and nu:
            item.append(nu)
            i += 1
            continue

        if not nu:
            ferme_liste()
            i += 1
            continue

        # --- paragraphe
        ferme_liste()
        corps = []
        while i < n and lignes[i].strip() and not re.match(
            r"(#{1,6}\s|\||>|```|-\s|\d+\.\s|-{3,}$)", lignes[i].strip()
        ):
            corps.append(lignes[i].strip())
            i += 1
        sortie.append(f'<p style="margin:9px 0;">{enligne(" ".join(corps))}</p>')

    ferme_liste()
    return "\n".join(sortie)


GABARIT = """<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>{titre}</title>
</head>
<body style="font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#16161a;
line-height:1.5;max-width:900px;margin:32px auto;padding:0 24px;background:#ffffff;">
{corps}
</body>
</html>
"""


def main():
    entree, sortie_html = sys.argv[1], sys.argv[2]
    with open(entree, encoding="utf-8") as fichier:
        source = fichier.read()
    corps = convertis(source)
    titre = "Dossier d'optimisation - Paranoia Client"
    with open(sortie_html, "w", encoding="utf-8") as fichier:
        fichier.write(GABARIT.format(titre=titre, corps=corps))
    print(f"{sortie_html}: {len(corps)} caracteres de corps")


if __name__ == "__main__":
    main()

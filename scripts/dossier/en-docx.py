#!/usr/bin/env python3
"""Convertit le dossier Markdown en .docx, pour ouverture directe dans Google Docs.

Pourquoi ecrire l'OOXML a la main: LibreOffice est installe dans ce conteneur
mais ne charge aucun fichier source (« source file could not be loaded », y
compris sur un HTML de trois lignes), et il n'y a ni pandoc ni python-docx. Un
.docx est une archive ZIP de quelques parties XML; on les ecrit.

Choix guide par une contrainte: le resultat ne peut pas etre ouvert ici pour
etre verifie a l'oeil. On reste donc sur le sous-ensemble le plus standard
possible -- pas de numbering.xml, pas de styles de tableau nommes, des bordures
posees explicitement -- pour qu'il n'y ait rien qui puisse etre refuse a
l'import. Les listes portent leur puce en caractere: visuellement identique, et
une reference de numerotation en moins a casser.

Les titres, eux, passent par de vrais styles Heading 1 a 4: c'est ce qui donne
un plan navigable dans Google Docs, et c'est indispensable sur cinquante pages.
"""
import html
import re
import sys
import zipfile

W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'

# A4 moins deux centimetres de marge de chaque cote, en twips.
LARGEUR_UTILE = 11906 - 2 * 1134

GRAS = re.compile(r"\*\*(.+?)\*\*")
ITAL = re.compile(r"(?<![\w*])\*([^*\n]+?)\*(?![\w*])")
CODE = re.compile(r"`([^`\n]+?)`")
LIEN = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")


def esc(texte: str) -> str:
    return html.escape(texte, quote=False)


def _run(texte: str, gras: bool, ital: bool, code: bool) -> str:
    props = []
    if code:
        props.append('<w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="19"/>'
                     '<w:shd w:val="clear" w:color="auto" w:fill="F1F1F3"/>')
    if gras:
        props.append("<w:b/>")
    if ital:
        props.append("<w:i/>")
    rpr = f"<w:rPr>{''.join(props)}</w:rPr>" if props else ""
    return f'<w:r>{rpr}<w:t xml:space="preserve">{esc(texte)}</w:t></w:r>'


def _emets(texte: str, jetons, gras: bool, ital: bool, code: bool = False) -> str:
    """Rend les runs, en descendant dans les marqueurs imbriques.

    L'imbrication n'est pas theorique: le dossier ecrit souvent
    {@code **`LATENCE` : ...**}, donc un jeton de code a l'interieur d'un jeton
    de gras. La premiere version rendait le contenu du gras tel quel, marqueur
    compris -- soit un octet nul dans le XML, que tout lecteur refuse. Le fichier
    etait invalide et rien ne l'aurait dit avant l'ouverture.
    """
    out = []
    for part in re.split(r"(\x00\d+\x00)", texte):
        if not part:
            continue
        marque = re.fullmatch(r"\x00(\d+)\x00", part)
        if not marque:
            out.append(_run(part, gras, ital, code))
            continue
        genre, contenu = jetons[int(marque.group(1))]
        if genre == "code":
            out.append(_emets(contenu, jetons, gras, ital, code=True))
        elif genre == "gras":
            out.append(_emets(contenu, jetons, True, ital, code))
        else:
            out.append(_emets(contenu, jetons, gras, True, code))
    return "".join(out)


def runs(texte: str) -> str:
    """Le texte d'un paragraphe, decoupe en runs gras / italique / code."""
    jetons = []

    def garde_code(m):
        jetons.append(("code", m.group(1)))
        return f"\x00{len(jetons) - 1}\x00"

    def garde_gras(m):
        jetons.append(("gras", m.group(1)))
        return f"\x00{len(jetons) - 1}\x00"

    def garde_ital(m):
        jetons.append(("ital", m.group(1)))
        return f"\x00{len(jetons) - 1}\x00"

    # Le code d'abord: son contenu ne doit pas etre relu.
    restant = CODE.sub(garde_code, texte)
    restant = LIEN.sub(r"\1", restant)
    restant = GRAS.sub(garde_gras, restant)
    restant = ITAL.sub(garde_ital, restant)

    return _emets(restant, jetons, False, False) or "<w:r><w:t/></w:r>"


def para(texte, style=None, avant=None, apres=None, indent=None, garde=False):
    props = []
    if style:
        props.append(f'<w:pStyle w:val="{style}"/>')
    if indent:
        props.append(f'<w:ind w:left="{indent}"/>')
    if avant is not None or apres is not None:
        props.append(
            f'<w:spacing w:before="{avant or 0}" w:after="{apres or 0}"/>'
        )
    if garde:
        props.append("<w:keepLines/>")
    ppr = f"<w:pPr>{''.join(props)}</w:pPr>" if props else ""
    return f"<w:p>{ppr}{runs(texte)}</w:p>"


def para_brut(contenu_runs, style=None, indent=None, avant=None, apres=None):
    props = []
    if style:
        props.append(f'<w:pStyle w:val="{style}"/>')
    if indent:
        props.append(f'<w:ind w:left="{indent}"/>')
    if avant is not None or apres is not None:
        props.append(f'<w:spacing w:before="{avant or 0}" w:after="{apres or 0}"/>')
    ppr = f"<w:pPr>{''.join(props)}</w:pPr>" if props else ""
    return f"<w:p>{ppr}{contenu_runs}</w:p>"


def bloc_code(lignes):
    """Un seul paragraphe, les lignes separees par des sauts: le bloc reste soude."""
    morceaux = []
    for index, ligne in enumerate(lignes):
        if index:
            morceaux.append("<w:r><w:br/></w:r>")
        morceaux.append(
            "<w:r><w:rPr><w:rFonts w:ascii=\"Consolas\" w:hAnsi=\"Consolas\"/>"
            f"<w:sz w:val=\"18\"/></w:rPr><w:t xml:space=\"preserve\">{esc(ligne)}"
            "</w:t></w:r>"
        )
    return (
        "<w:p><w:pPr><w:pStyle w:val=\"CodeBloc\"/><w:keepLines/></w:pPr>"
        + "".join(morceaux)
        + "</w:p>"
    )


def filet():
    return (
        "<w:p><w:pPr><w:pBdr><w:bottom w:val=\"single\" w:sz=\"6\" w:space=\"1\" "
        "w:color=\"D5D5DD\"/></w:pBdr><w:spacing w:before=\"240\" w:after=\"240\"/>"
        "</w:pPr><w:r><w:t/></w:r></w:p>"
    )


def cellules(ligne):
    brut = ligne.strip()
    if brut.startswith("|"):
        brut = brut[1:]
    if brut.endswith("|"):
        brut = brut[:-1]
    return [c.strip() for c in brut.split("|")]


def est_separateur(ligne):
    return bool(re.fullmatch(r"\|[\s:|-]+\|?", ligne.strip())) and "-" in ligne


def largeurs(entetes, corps):
    """Repartit la largeur selon le contenu, avec un plancher.

    Sans ca, une table « drapeau | defaut | effet » donne trois colonnes egales
    et la colonne d'explication se lit sur huit lignes pendant que celle du
    defaut en gaspille la moitie.
    """
    nb = len(entetes)
    poids = []
    for k in range(nb):
        longueurs = [len(entetes[k])]
        for rangee in corps:
            if k < len(rangee):
                longueurs.append(len(rangee[k]))
        # La moyenne plutot que le maximum: une seule cellule longue ne doit pas
        # emporter toute la largeur.
        moyenne = sum(longueurs) / len(longueurs)
        poids.append(max(moyenne, 6.0))
    total = sum(poids)
    brutes = [max(int(LARGEUR_UTILE * p / total), 900) for p in poids]
    # Reajuste pour que la somme fasse exactement la largeur utile.
    ecart = LARGEUR_UTILE - sum(brutes)
    brutes[brutes.index(max(brutes))] += ecart
    return brutes


BORDURE = (
    '<w:tblBorders>'
    '<w:top w:val="single" w:sz="4" w:space="0" w:color="C7C7CF"/>'
    '<w:left w:val="single" w:sz="4" w:space="0" w:color="C7C7CF"/>'
    '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="C7C7CF"/>'
    '<w:right w:val="single" w:sz="4" w:space="0" w:color="C7C7CF"/>'
    '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="C7C7CF"/>'
    '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="C7C7CF"/>'
    '</w:tblBorders>'
)


def tableau(entetes, corps):
    cols = largeurs(entetes, corps)
    out = [
        "<w:tbl><w:tblPr>",
        f'<w:tblW w:w="{LARGEUR_UTILE}" w:type="dxa"/>',
        BORDURE,
        '<w:tblCellMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/>'
        '<w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar>',
        "</w:tblPr><w:tblGrid>",
    ]
    for largeur in cols:
        out.append(f'<w:gridCol w:w="{largeur}"/>')
    out.append("</w:tblGrid>")

    # Rangee d'en-tete, repetee en haut de chaque page.
    out.append("<w:tr><w:trPr><w:tblHeader/></w:trPr>")
    for k, tete in enumerate(entetes):
        out.append(
            f'<w:tc><w:tcPr><w:tcW w:w="{cols[k]}" w:type="dxa"/>'
            '<w:shd w:val="clear" w:color="auto" w:fill="EEEEF2"/></w:tcPr>'
            f'<w:p><w:pPr><w:pStyle w:val="Cellule"/></w:pPr>'
            f'<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">{esc(tete)}</w:t></w:r>'
            "</w:p></w:tc>"
        )
    out.append("</w:tr>")

    for rangee in corps:
        out.append("<w:tr>")
        for k in range(len(entetes)):
            valeur = rangee[k] if k < len(rangee) else ""
            out.append(
                f'<w:tc><w:tcPr><w:tcW w:w="{cols[k]}" w:type="dxa"/></w:tcPr>'
                + para_brut(runs(valeur), style="Cellule")
                + "</w:tc>"
            )
        out.append("</w:tr>")
    out.append("</w:tbl>")
    # Un paragraphe vide apres un tableau: deux tableaux colles fusionnent.
    out.append('<w:p><w:pPr><w:spacing w:after="0"/></w:pPr><w:r><w:t/></w:r></w:p>')
    return "".join(out)


def corps_document(source):
    lignes = source.split("\n")
    out = []
    i = 0
    n = len(lignes)
    puce_en_cours = False

    while i < n:
        nu = lignes[i].strip()

        if nu.startswith("```"):
            i += 1
            bloc = []
            while i < n and not lignes[i].strip().startswith("```"):
                bloc.append(lignes[i])
                i += 1
            i += 1
            out.append(bloc_code(bloc))
            continue

        if nu.startswith("|") and i + 1 < n and est_separateur(lignes[i + 1]):
            entetes = cellules(nu)
            i += 2
            rangees = []
            while i < n and lignes[i].strip().startswith("|"):
                rangees.append(cellules(lignes[i]))
                i += 1
            out.append(tableau(entetes, rangees))
            continue

        if re.fullmatch(r"-{3,}", nu):
            out.append(filet())
            i += 1
            continue

        titre = re.match(r"(#{1,6})\s+(.*)", nu)
        if titre:
            niveau = min(len(titre.group(1)), 4)
            out.append(para(titre.group(2), style=f"Heading{niveau}"))
            i += 1
            continue

        if nu.startswith(">"):
            bloc = []
            while i < n and lignes[i].strip().startswith(">"):
                bloc.append(lignes[i].strip()[1:].strip())
                i += 1
            out.append(para(" ".join(bloc), style="Citation"))
            continue

        puce = re.match(r"-\s+(.*)", nu)
        numero = re.match(r"(\d+)\.\s+(.*)", nu)
        if puce or numero:
            texte = [puce.group(1) if puce else f"{numero.group(1)}. {numero.group(2)}"]
            prefixe = "• " if puce else ""
            i += 1
            # Les lignes suivantes non vides et non structurelles appartiennent a
            # l'item: le dossier enveloppe ses lignes a quatre-vingts colonnes.
            while i < n and lignes[i].strip() and not re.match(
                r"(#{1,6}\s|\||>|```|-\s|\d+\.\s|-{3,}$)", lignes[i].strip()
            ):
                texte.append(lignes[i].strip())
                i += 1
            out.append(
                para(prefixe + " ".join(texte), indent=340, avant=20, apres=40)
            )
            puce_en_cours = True
            continue

        if not nu:
            puce_en_cours = False
            i += 1
            continue

        bloc = []
        while i < n and lignes[i].strip() and not re.match(
            r"(#{1,6}\s|\||>|```|-\s|\d+\.\s|-{3,}$)", lignes[i].strip()
        ):
            bloc.append(lignes[i].strip())
            i += 1
        out.append(para(" ".join(bloc)))

    out.append(
        '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
        '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" '
        'w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
    )
    return "".join(out)


STYLES = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles {W}>
  <w:docDefaults>
    <w:rPrDefault><w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:sz w:val="21"/><w:szCs w:val="21"/>
    </w:rPr></w:rPrDefault>
    <w:pPrDefault><w:pPr>
      <w:spacing w:before="0" w:after="140" w:line="288" w:lineRule="auto"/>
    </w:pPr></w:pPrDefault>
  </w:docDefaults>

  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/><w:qFormat/>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="420" w:after="160"/>
      <w:outlineLvl w:val="0"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="40"/><w:color w:val="1A1A22"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="320" w:after="120"/>
      <w:outlineLvl w:val="1"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="30"/><w:color w:val="2B2B38"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="260" w:after="100"/>
      <w:outlineLvl w:val="2"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="25"/><w:color w:val="3A3A4A"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading4">
    <w:name w:val="heading 4"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="220" w:after="80"/>
      <w:outlineLvl w:val="3"/></w:pPr>
    <w:rPr><w:b/><w:sz w:val="22"/><w:color w:val="4A4A5C"/></w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="CodeBloc">
    <w:name w:val="Bloc de code"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr>
      <w:shd w:val="clear" w:color="auto" w:fill="F5F5F7"/>
      <w:pBdr>
        <w:top w:val="single" w:sz="4" w:space="4" w:color="E0E0E6"/>
        <w:left w:val="single" w:sz="4" w:space="4" w:color="E0E0E6"/>
        <w:bottom w:val="single" w:sz="4" w:space="4" w:color="E0E0E6"/>
        <w:right w:val="single" w:sz="4" w:space="4" w:color="E0E0E6"/>
      </w:pBdr>
      <w:spacing w:before="120" w:after="160" w:line="240" w:lineRule="auto"/>
    </w:pPr>
    <w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="18"/></w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Citation">
    <w:name w:val="Citation"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr>
      <w:pBdr><w:left w:val="single" w:sz="18" w:space="8" w:color="7C6CF0"/></w:pBdr>
      <w:shd w:val="clear" w:color="auto" w:fill="F6F5FF"/>
      <w:ind w:left="200"/><w:spacing w:before="160" w:after="160"/>
    </w:pPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Cellule">
    <w:name w:val="Cellule de tableau"/><w:basedOn w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:before="20" w:after="20" w:line="252" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:sz w:val="19"/></w:rPr>
  </w:style>
</w:styles>
"""

CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>
"""

RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>
"""

DOC_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>
"""

CORE = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
 xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>Dossier d'optimisation - Paranoia Client</dc:title>
  <dc:subject>Optimisations du launcher, du mod client, de la CI et de la publication</dc:subject>
  <dcterms:created xsi:type="dcterms:W3CDTF">2026-09-26T00:00:00Z</dcterms:created>
</cp:coreProperties>
"""

APP = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>paranoia-md2docx</Application>
</Properties>
"""


def main():
    entree, sortie = sys.argv[1], sys.argv[2]
    with open(entree, encoding="utf-8") as fichier:
        source = fichier.read()

    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
        f"<w:document {W}><w:body>{corps_document(source)}</w:body></w:document>"
    )

    with zipfile.ZipFile(sortie, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", CONTENT_TYPES)
        zf.writestr("_rels/.rels", RELS)
        zf.writestr("word/document.xml", document)
        zf.writestr("word/_rels/document.xml.rels", DOC_RELS)
        zf.writestr("word/styles.xml", STYLES)
        zf.writestr("docProps/core.xml", CORE)
        zf.writestr("docProps/app.xml", APP)

    print(f"{sortie}: document.xml = {len(document)} octets")


if __name__ == "__main__":
    main()

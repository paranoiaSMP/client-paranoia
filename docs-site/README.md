# Page de telechargement

Page publique ou les joueurs recuperent l installeur. Elle interroge l API
GitHub au chargement, recupere la derniere release et pointe le bouton sur
l installeur NSIS (`...-setup.exe`), jamais sur l executable brut qui ne
fonctionne pas seul.

Si l API ne repond pas, le bouton laisse place a un lien vers la page des
releases: la page reste utilisable meme quand la detection echoue.

## Publier

Le workflow `deploy-download-page` publie ce dossier a chaque push sur `main`.
Il faut l activer une fois: **Settings > Pages > Source: GitHub Actions**.

## Depot prive

Un depot prive impose deux limites:

1. GitHub Pages n est disponible que sur les offres payantes.
2. L API des releases ne repond pas aux visiteurs anonymes: la page affichera
   toujours le repli, et les fichiers ne seront pas telechargeables.

Pour une distribution reellement publique, deux options:

- rendre ce depot public;
- creer un depot public dedie aux telechargements, y publier les releases et
  y heberger cette page. Il suffit alors de changer `OWNER` et `REPO` dans
  `index.html`.

## Adapter

Les constantes sont en haut du `<script>` de `index.html`:

```js
const OWNER = "paranoiaSMP";
const REPO = "client-paranoia";
```

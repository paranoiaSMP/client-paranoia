# Dossier d'optimisation — Paranoia Client

**Tout ce qui fait de Paranoia un client optimisé : ce qui est posé, où, pourquoi,
avec quels chiffres, et ce qui a été refusé.**

Version du dossier : 25 septembre 2026 — état du dépôt `paranoiaSMP/client-paranoia`
au commit `8d599e2`, versions publiées 0.7.20.

---

## Comment lire ce dossier

Ce document est écrit pour être lu de bout en bout par quelqu'un qui veut
comprendre l'ensemble, et consulté par morceaux par quelqu'un qui cherche un
réglage précis. Trois conventions :

- **Chaque optimisation est donnée avec son chiffre et sa raison.** « Plus
  rapide » n'est pas une information ; « 1 040 appels de dessin ramenés à 218 »
  en est une. Quand un chiffre a été mesuré, c'est dit ; quand il est déduit d'un
  calcul, le calcul est écrit ; quand il n'y a pas de mesure, c'est dit aussi.
- **Chaque optimisation renvoie au fichier qui la contient.** Le code est la
  seule source de vérité ; ce dossier est une carte, pas un substitut.
- **La partie III est aussi importante que les parties I et II.** Elle recense ce
  qui a été refusé, et pourquoi. Dans un client de PvP, la liste de ce qu'on n'a
  pas fait dit plus sur la qualité du travail que la liste de ce qu'on a fait.

Un glossaire se trouve en annexe F. Les termes techniques y sont définis en une
ou deux phrases : *1 % low*, *tick*, *frustum*, *occlusion*, *IHOP*, *mixin*,
*région G1*, *mode immédiat*.

**Pour le lire ailleurs que sur GitHub.** Deux scripts régénèrent ce dossier
dans un format qui se colle ou s'ouvre dans un traitement de texte, titres,
tableaux et blocs de code compris :

```bash
python3 scripts/dossier/en-html.py docs/dossier-optimisation.md dossier.html
python3 scripts/dossier/en-docx.py docs/dossier-optimisation.md dossier.docx
```

Le `.html` s'ouvre dans un navigateur et se copie-colle tel quel dans Google
Docs ou Word. Le `.docx` s'ouvre directement dans l'un comme dans l'autre, avec
un plan navigable — les titres y sont de vrais styles de titre, ce qui compte
sur cinquante pages.

---

## Sommaire

**Partie 0 — La règle qui commande tout**
- 0.1 Quatre-vingt-dix pour cent de PvP
- 0.2 Ce que la règle interdit, nommément
- 0.3 Les trois questions posées à chaque optimisation
- 0.4 Une règle qui ne vit pas dans un commentaire

**Partie I — Avant que le jeu démarre : le launcher**
- 1.1 Carte du système : qui optimise quoi
- 1.2 Les six mods de performance
- 1.3 Les réglages vidéo, et les trois qui sont interdits
- 1.4 Sodium, installé puis configuré
- 1.5 La machine virtuelle Java : dix drapeaux
- 1.6 Les trois drapeaux qui empêchent le jeu de démarrer
- 1.7 La priorité du processus
- 1.8 La version de Java, imposée par Mojang
- 1.9 La mémoire allouée
- 1.10 Le démarrage du launcher lui-même
- 1.11 Les téléchargements

**Partie II — Dans le jeu : le mod client**
- 2.1 Ce que le mod optimise, et ce qu'il ne touche pas
- 2.2 Le budget de particules
- 2.3 L'allègement du décor lointain
- 2.4 L'occlusion, et ses sept garde-fous
- 2.5 Les blocs animés
- 2.6 Le ralentissement hors focus
- 2.7 Le HUD : le coût qu'on croyait négligeable
- 2.8 Le crystal instantané
- 2.9 Les cosmétiques : une texture pour trente porteurs
- 2.10 Le réseau du mod : ne pas redemander ce qui n'a pas bougé
- 2.11 Les instruments : 1 % low, diagnostic, TPS, ping, portée

**Partie III — Ce qui a été refusé**
- 3.1 Les trois réglages vidéo interdits
- 3.2 Le renvoi de clic droit : une prémisse fausse
- 3.3 Le module de consommation : une régression en production
- 3.4 La prédiction de recul
- 3.5 Les réglages Sodium écartés
- 3.6 ZGC : pas une ligne de plus, une branche entière
- 3.7 Ce que le client ne fera jamais

**Partie IV — Comment on sait que ça marche**
- 4.1 Les sondes : lire l'API plutôt que la deviner
- 4.2 Les sondes de bytecode
- 4.3 Les quatre bancs d'essai
- 4.4 Les vérifications de build
- 4.5 Le panneau de diagnostic comme preuve en jeu
- 4.6 Ce qui n'est pas mesuré

**Partie V — Livrer sans casser**
- 5.1 Le manifeste unique
- 5.2 La publication en deux temps
- 5.3 L'interrupteur du serveur

**Annexes**
- A. Table de tous les réglages d'optimisation
- B. Les dix drapeaux JVM, un par ligne
- C. Les six mods de performance
- D. Chronologie des optimisations
- E. Où regarder dans le code
- F. Glossaire
- G. Ce qui reste à faire

---
---

# Partie 0 — La règle qui commande tout

## 0.1 Quatre-vingt-dix pour cent de PvP

Tout ce qui suit découle d'une seule phrase, posée comme contrainte de départ :

> Quatre-vingt-dix pour cent des joueurs font du PvP. Optimise pour ces
> personnes-là, et surtout ne fais pas d'optimisation contraire à une précision
> ou à une justesse dans le PvP.

Cette phrase n'est pas un souhait de confort, c'est un critère d'admission. Elle
change la nature de l'exercice, parce qu'elle disqualifie la moitié des
optimisations que n'importe quel guide de performance Minecraft recommande.

Le raisonnement tient en trois temps :

1. **En PvP, l'information que l'écran donne au joueur est une ressource de
   combat.** La particule de coup critique dit que le crit est passé. L'entité
   lointaine dit que quelqu'un arrive. Le bloc posé qui apparaît immédiatement dit
   que la pose a été prise en compte.
2. **La plupart des optimisations visuelles gagnent des images en retirant
   exactement cette information.** Ce n'est pas un effet de bord, c'est leur
   mécanisme : moins de particules, moins d'entités dessinées, moins de mises à
   jour lointaines.
3. **Donc une optimisation qui retire de l'information fait perdre le combat
   qu'elle accélère.** Soixante images de plus ne compensent pas un adversaire
   qu'on n'a pas vu arriver.

Cette phrase — « elle fait perdre le combat qu'elle accélère » — est écrite
telle quelle dans quatre fichiers du dépôt, aux quatre endroits où la tentation
se présente : `performanceMods.ts`, `graphicsPreset.ts`, `sodiumPreset.ts` et
`test-graphics-preset.ts`. Ce n'est pas de la redondance : c'est là qu'on la
relit quand on est en train d'ajouter un réglage.

## 0.2 Ce que la règle interdit, nommément

La règle ne resterait qu'une déclaration si elle ne désignait pas des cas
précis. Voici la liste des interdictions explicites, avec leur raison. Chacune
figure dans le code, à l'endroit où on serait tenté de la défaire.

| Interdit | Ce que ça gagnerait | Ce que ça coûterait |
|---|---|---|
| `particles: minimal` | quelques images sur les explosions | les particules de coup critique sont un retour d'information : elles disent que le crit est passé |
| `entityDistanceScaling` bas | beaucoup d'images dans une base peuplée | cesse d'afficher les entités lointaines, donc cache le joueur qui arrive |
| `simulationDistance` bas | de la logique de jeu en moins | un adversaire loin se met à jour moins bien |
| `chunkBuildDeferMode` (Sodium) | des reconstructions de morceaux différées | retarde l'apparition des blocs posés ou cassés — en PvP, le retour immédiat d'un bloc posé est tout ce qui compte |
| `leavesQuality` / `weatherQuality` (Sodium) | des images sur les feuillages | un feuillage rendu plein peut cacher quelqu'un |
| `useNoErrorGLContext` (Sodium) | quelques pourcents en supprimant les contrôles du pilote | un écran noir sur les pilotes capricieux |
| distance de rendu abaissée d'office | le plus gros levier de tous | voir loin compte en combat ; ce réglage reste au joueur |
| escamoter un joueur pour cause de distance | énormément, dans une base peuplée | c'est le pire défaut possible : un adversaire invisible parce que le client a décidé de l'économiser |

La dernière ligne est la plus importante, et elle est absolue : **aucun être
vivant n'est jamais écarté du rendu pour cause de distance, dans aucune
configuration du mod.** La seule raison qui peut faire disparaître un joueur est
l'occlusion — un mur plein entre lui et la caméra — et elle demande un réglage
séparé, désactivé par défaut, entouré de sept garde-fous décrits en 2.4.

## 0.3 Les trois questions posées à chaque optimisation

Toute optimisation du dépôt a dû répondre à trois questions avant d'être écrite.
Ce n'est pas une procédure formelle ; c'est le filtre qui explique pourquoi
certaines choses sont là et d'autres non.

**1. Est-ce que ça retire de l'information au joueur ?**
Si oui : refus, ou alors réglage séparé désactivé par défaut, avec la raison
écrite sur le réglage lui-même. C'est le cas du budget de particules, de
l'allègement du décor, des blocs animés, du ralentissement hors focus. Les quatre
sont rangés dans un onglet « Optimisation » pour qu'on voie d'un coup d'œil tout
ce qu'on a accepté de sacrifier.

**2. Est-ce que ça peut rendre le jeu faux plutôt que lent ?**
Un drapeau JVM refusé n'est pas un réglage qui se dégrade, c'est un jeu qui ne
démarre plus. Un fichier de configuration mal écrit est un plantage au démarrage
chez tout le monde. Une prédiction qui se trompe est une désynchronisation. Ces
cas demandent une vérification machine, pas une relecture — d'où la partie IV.

**3. Est-ce que ça enlève une attente que le client s'imposait à lui-même ?**
C'est la meilleure catégorie d'optimisation, celle qui ne coûte rien à personne.
Elle contient : la visée brute, le plafond d'images, la synchronisation verticale
coupée, la limite d'images préparées en avance, le crystal effacé dès la frappe.
Aucune ne retire d'information ; toutes raccourcissent le chemin entre le geste
du joueur et son effet.

## 0.4 Une règle qui ne vit pas dans un commentaire

Une règle qui n'existe que dans un commentaire finit par se faire casser, par
quelqu'un de bien intentionné qui cherche des images par seconde. Celle-ci fait
échouer l'intégration continue.

`apps/backend/scripts/test-graphics-preset.ts` contient :

```ts
const ATTENDU_PARTOUT = ["rawMouseInput:true", "maxFps:240"];
const JAMAIS = ["particles:", "entityDistanceScaling:", "simulationDistance:"];
```

Le banc écrit un `options.txt`, applique le préréglage, relit le fichier, et
échoue si l'une des trois clés interdites y apparaît — quelle que soit sa valeur.
Il tourne à chaque push, sur le workflow `build-windows`, avant tout le reste.

C'est la seule manière connue de faire tenir une contrainte de gameplay dans un
dépôt qui évolue : la transformer en test.

---
---

# Partie I — Avant que le jeu démarre : le launcher

## 1.1 Carte du système : qui optimise quoi

Paranoia n'est pas un mod, c'est quatre pièces qui ont chacune leurs leviers. Les
confondre mène à chercher une optimisation au mauvais endroit.

| Pièce | Ce qu'elle est | Leviers d'optimisation |
|---|---|---|
| **Launcher** (Tauri + React) | l'application qu'on ouvre | son propre temps de démarrage |
| **Sidecar** (`@paranoia/backend`, TypeScript) | le service local qui installe et lance le jeu | mods de performance, `options.txt`, `sodium-options.json`, drapeaux JVM, mémoire, priorité du processus, téléchargements |
| **Mod client** (Fabric, Java) | ce qui tourne *dans* Minecraft | particules, entités, blocs animés, HUD, focus, crystal, textures, réseau du mod |
| **CI + publication** | GitHub Actions | ce qui empêche une optimisation d'être fausse, et ce qui empêche une régression d'atteindre tout le monde d'un coup |

Le partage de responsabilité entre le sidecar et le mod suit une ligne simple :
**tout ce qui peut être décidé avant le lancement l'est avant le lancement.** Un
réglage écrit dans `options.txt` ne coûte rien à l'exécution ; le même réglage
imposé par un mixin coûte un appel par image, pour toute la partie.

### Versions de Minecraft couvertes

Le mod est construit pour plusieurs versions à la fois, une par sous-projet
Gradle :

| Version | État | Jar publié en 0.7.20 |
|---|---|---|
| 1.21.8 | construite, publiée | `paranoia-client-0.5.0+1.21.8.jar` (208 Ko) |
| 1.21.10 | construite, publiée | `paranoia-client-0.5.0+1.21.10.jar` (209 Ko) |
| 1.21.11 | construite, publiée | `paranoia-client-0.5.0+1.21.11.jar` (209 Ko) |
| 26.1.2 | déclarée, en attente de mappings Fabric | — |
| 26.2 | déclarée, en attente de mappings Fabric | — |

Les sources de `src/main/java` sont recompilées dans chaque sous-projet, contre le
jar Minecraft de sa version : c'est ce qui permet au HUD et au menu d'utiliser
`DrawContext` et `Screen` directement, sans couche d'abstraction, donc sans coût.
Seul ce qui a changé de nom ou de signature passe par l'interface
`ClientPlatform`.

Les versions `26.x` ne se construisent pas encore, et ce n'est pas un défaut du
dépôt : Fabric ne publie pas de mappings yarn pour toute la ligne 26. Le
`settings.gradle` ignore un sous-projet dont les mappings manquent plutôt que
d'échouer, et la version se construira d'elle-même au premier build qui suivra
leur publication.

## 1.2 Les six mods de performance

**Fichier :** `apps/backend/src/modules/launcher/performanceMods.ts`

### La décision de fond : ne pas refaire Sodium

Le client optimise ce qu'un mod de sa taille peut atteindre : les entités, les
blocs animés, les particules, ses propres allocations. Il ne touche pas au rendu
du terrain, qui est de très loin le poste le plus lourd du jeu. Le réécrire
serait plusieurs années de travail pour arriver, au mieux, là où Sodium est déjà.

On installe donc Sodium plutôt que de le refaire, et cinq autres qui couvrent ce
que Sodium ne couvre pas.

### La règle d'admission

Trois conditions, et les six mods les remplissent toutes :

1. **Aucun ne se voit à l'écran.** Pas de changement visuel, donc pas
   d'information retirée au joueur.
2. **Aucun ne touche au gameplay.** Pas de portée modifiée, pas de timing changé.
3. **Aucun ne recouvre le travail du client.** Sodium s'occupe du terrain, le
   client s'occupe des entités.

### La liste

| Mod | Rôle | Ce qu'il fait, concrètement |
|---|---|---|
| **Sodium** | rendu du terrain | remplace le moteur de rendu des blocs. Le gain le plus important de la liste, et de loin |
| **Lithium** | logique de jeu | réécrit des algorithmes du serveur intégré et du client sans changer leur résultat |
| **FerriteCore** | empreinte mémoire | déduplique les états de blocs et les structures de données du monde |
| **ModernFix** | démarrage et mémoire | chargement paresseux de ce qui n'est pas encore nécessaire |
| **ImmediatelyFast** | dessin du HUD et des interfaces | regroupe les appels de dessin en mode immédiat |
| **Krypton** | pile réseau | allège le traitement des paquets |

### Deux entrées qui méritent un mot

**ImmediatelyFast** compte plus ici qu'ailleurs, et de plus en plus. Le client
dessine six éléments de HUD avec du texte agrandi, un graphe et une
grille de touches, à chaque image, et tout cela passe par le mode immédiat. Le
regroupement des rangées de `Shapes` (voir 2.7) a déjà ramené une image de HUD de
1 040 appels à 218 ; ImmediatelyFast travaille sur ce qui reste, et sur tout ce
que le jeu lui-même dessine de la même façon.

**Krypton** est le seul de la liste qui touche à la latence au sens littéral. Il
faut être honnête sur ce qu'il fait : **il ne raccourcit pas le trajet jusqu'au
serveur**, ce qu'aucun mod ne peut faire. Il enlève du travail entre la réception
d'un paquet et sa prise en compte. Le gain est réel et modeste.

### Trois précautions d'implémentation

**À la création du profil, et uniquement là.** Un joueur qui retire Sodium a une
raison de le faire : un pilote graphique capricieux, un shader incompatible, une
préférence. Le lui remettre à chaque lancement serait lui reprendre une décision
qu'il a prise exprès. Un fichier témoin, `.paranoia-performance-mods.json`, garde
la trace de ce qui a été posé pour ne jamais le reposer.

**Le disque tranche, pas le témoin.** Un profil peut naître en copiant l'instance
d'un autre launcher, laquelle contient souvent déjà Sodium. Poser un second
exemplaire ne ferait pas un doublon sans conséquence : **Fabric refuse de démarrer
quand deux versions du même mod sont dans le dossier**, et le jeu ne se lancerait
plus du tout. Le dossier `mods/` est donc relu avant chaque pose, et une version
déjà présente est laissée telle quelle.

Le motif de reconnaissance ne suit pas toujours le slug Modrinth : FerriteCore
s'appelle `ferrite-core` chez Modrinth et `ferritecore` dans son fichier. D'où
les expressions régulières explicites, une par mod.

**Chaque mod est traité pour lui-même.** Modrinth injoignable, version de
Minecraft trop récente pour que Sodium ait publié, projet renommé : rien de tout
cela n'empêche les autres de s'installer, ni la création du profil d'aboutir. Un
profil sans Sodium reste un profil qui se lance.

## 1.3 Les réglages vidéo, et les trois qui sont interdits

**Fichier :** `apps/backend/src/modules/launcher/graphicsPreset.ts`

**Banc d'essai :** `apps/backend/scripts/test-graphics-preset.ts`

### Le défaut corrigé

Le mode graphique était demandé à la création du profil, enregistré, et servait à
choisir un manifeste de mods — mais **il ne touchait aucun réglage vidéo**.
Choisir « Performance » lançait Minecraft avec ses valeurs d'origine :
synchronisation verticale active, graphismes détaillés, mélange de biomes à cinq.
C'était le même oubli que celui déjà corrigé sur la résolution, elle aussi
enregistrée sans jamais atteindre le jeu.

### Deux groupes, et la frontière entre eux est la règle de la partie 0

**`LATENCE` : posé sur tous les modes, y compris « beauty ».**

Ces valeurs ne sont pas des arbitrages de qualité. Elles ne rabotent rien, ne
cachent rien, et quelqu'un qui a choisi la qualité les veut autant que les
autres.

| Clé | Valeur | Pourquoi |
|---|---|---|
| `rawMouseInput` | `true` | La visée devient 1:1 avec la main : plus d'accélération ajoutée par le système. Ne gagne **aucune image** et n'est pas là pour ça. C'est le seul réglage du jeu qui agit directement sur la justesse d'un mouvement de souris — une courbe d'accélération rend deux gestes identiques différents à l'écran. |
| `maxFps` | `240` | Voir le calcul ci-dessous. |

**Le calcul du plafond d'images.** Le jeu ne lit les entrées qu'une fois par
image : le plafond d'images est donc aussi un plancher de latence.

- à 120 images par seconde (la valeur d'origine), un clic attend jusqu'à
  **8,3 ms** avant d'être vu ;
- à 240 images par seconde, **4,2 ms**.

Pourquoi pas l'illimité — que le jeu écrit « 260 » ? Deux raisons, toutes deux
liées à la régularité :

1. Une machine qui rend 500 images sans plafond chauffe, et l'étranglement
   thermique qui suit dégrade la régularité, c'est-à-dire précisément ce qu'on
   cherche à protéger.
2. Un débit qui oscille entre 300 et 500 fait varier l'intervalle
   d'échantillonnage des entrées.

**Un plafond haut mais tenu vaut mieux qu'un sommet plus haut et instable.**

**`PRESETS` : ce qui échange du visuel contre des images.**

Mode **performance** :

| Clé | Valeur | Pourquoi |
|---|---|---|
| `enableVsync` | `false` | Enlève jusqu'à une image entière de latence entre la souris et l'écran. Le réglage le plus utile de la liste pour du PvP, et il ne coûte visuellement qu'un déchirement possible de l'image. |
| `graphicsMode` | rapide | Feuillages opaques et eau simplifiée. |
| `biomeBlendRadius` | `0` | Le dégradé entre biomes se recalcule à chaque reconstruction de morceau : le passer à zéro accélère nettement les rebonds de framerate quand on se déplace. |
| `entityShadows` | `false` | Une ombre par entité, dessinée séparément. |
| `renderClouds` | `false` | — |

Mode **balanced** : `enableVsync: false`, `biomeBlendRadius: 1`. Ce qui ne se voit
pas, sans toucher à ce qui se voit.

Mode **beauty** : rien de `PRESETS`. Qui choisit la qualité ne veut pas qu'on la
lui rabote. Mais il reçoit `LATENCE` — et c'est un défaut qui a été corrigé :
la fonction sortait avant, donc « beauty » ne recevait ni la visée brute ni le
plafond d'images, deux réglages qui ne coûtent pourtant aucune qualité.

**Ce qui n'y figure pas volontairement :** la distance de rendu. C'est le plus
gros levier de tous, mais c'est aussi le seul qui change ce que le joueur voit du
terrain, et voir loin compte aussi en combat. Elle reste à lui.

### Trois détails d'écriture qui ont chacun une raison

**Les fins de ligne.** Un `options.txt` venu de Windows est en CRLF, et `$` en
mode multiligne s'arrête bien avant le retour chariot. La fonction `setOption`
traite les deux formes.

**La forme de `graphicsMode`.** Elle s'écrit tantôt par son rang (`0`), tantôt par
son nom entre guillemets (`"fast"`), selon la version de Minecraft. Plutôt que de
parier, on regarde comment le fichier l'écrit déjà et on répond dans la même
langue. Sans fichier existant, le rang fait foi — c'est la forme la plus ancienne
et la plus largement acceptée.

**Le moment.** Le préréglage est posé au premier lancement, pas à la création du
profil, et c'est délibéré. La copie d'un `options.txt` existant — depuis un autre
launcher, ou depuis le `.minecraft` vanilla — n'a lieu que si le fichier n'existe
pas encore. Écrire le préréglage plus tôt créait donc le fichier, et le joueur qui
importait ses réglages ne les recevait plus jamais. Ici, la copie a déjà eu lieu :
le préréglage se pose par-dessus, sur les quelques clés qui le concernent
seulement.

Le témoin `.paranoia-graphics.json` garantit que cela n'arrive qu'une fois dans la
vie du profil. **Ces réglages appartiennent au joueur dès qu'il y a touché.**

## 1.4 Sodium, installé puis configuré

**Fichier :** `apps/backend/src/modules/launcher/sodiumPreset.ts`

**Banc d'essai :** `apps/backend/scripts/test-sodium-preset.ts`

Installer un mod de performance et ne pas le configurer, c'est prendre la moitié
du gain. Sodium a ses propres options, dans son propre fichier, et elles sont
prudentes exprès — il ne sait pas sur quelle machine il tourne.

### Pourquoi on modifie au lieu d'écrire

Ce module ne crée jamais le fichier : il ne touche que celui que Sodium a déjà
écrit. Ce n'est pas de la prudence de principe, c'est un plantage évité.

La forme du fichier a été **lue dans le jar par la CI**, pas devinée : les clés
sont en camelCase, là où tout guide les écrit en snake_case. Mais lire les noms ne
suffisait pas. Sodium désérialise avec GSON, et **GSON n'exécute les
initialiseurs de champs que s'il trouve un constructeur sans argument**. Sinon il
alloue l'objet sans l'initialiser, et une section absente du JSON arrive à `null`
— le jeu planterait au démarrage, chez tout le monde, à cause d'un fichier que
nous aurions écrit.

Tant que cette question n'est pas tranchée par la sonde, partir du fichier de
Sodium la rend sans objet : toutes les sections y sont déjà.

**Conséquence à connaître :** le fichier n'existe qu'après un premier lancement.
Le réglage s'applique donc au deuxième. Le témoin n'est écrit que lorsqu'on a
vraiment modifié quelque chose, précisément pour que le premier lancement ne
consomme pas l'unique tentative.

### Les deux valeurs posées

| Section | Clé | Défaut Sodium | Valeur posée | Pourquoi |
|---|---|---|---|---|
| `advanced` | `cpuRenderAheadLimit` | 3 | **1** | Le nombre d'images que le processeur a le droit de préparer en avance sur la carte graphique. Chacune est une image d'écart entre le clic et ce qui s'affiche : c'est de la latence d'entrée, exactement comme la synchronisation verticale qu'on coupe déjà. |
| `quality` | `enableVignette` | true | **false** | L'assombrissement des bords de l'écran. Le couper ne retire aucune information — c'est un effet posé par-dessus l'image, pas du contenu — et rend les bords lisibles, là où arrive ce qu'on ne regarde pas. |

Deux valeurs seulement passent le filtre de la partie 0, et **l'une des deux ne
gagne même pas d'images : elle enlève de la latence.**

### Le contrôle de type avant écriture

Chaque clé doit exister, et être du bon type. Une version de Sodium qui l'aurait
renommée ou retypée ne doit pas recevoir une valeur qu'elle ne comprend pas :
mieux vaut ne rien poser et l'écrire dans le journal. C'est ce que fait la
comparaison `typeof actuel !== typeof reglage.valeur`.

Les réglages Sodium écartés sont listés en 3.5.

## 1.5 La machine virtuelle Java : dix drapeaux

**Fichier :** `apps/backend/src/modules/launcher/jvmFlags.ts`

**Banc d'essai :** `apps/backend/scripts/test-jvm-flags.ts`

### Pourquoi c'est le levier le plus lourd du projet

Minecraft fabrique des millions d'objets à très courte durée de vie par seconde.
Pendant une partie du ramassage, **le jeu est arrêté — pas ralenti**. C'est ce gel
qui fait le « 1 % low » bas qu'affiche le HUD, et c'est lui qui fait perdre un
combat : une pause au mauvais moment vaut une main manquée.

Les arguments JVM par défaut du launcher valaient, à un moment, `-XX:+UseG1GC`.
G1 est déjà le ramasse-miettes par défaut des JVM modernes : le seul drapeau
présent ne changeait donc **strictement rien**, et le levier le plus lourd du
projet n'avait jamais été actionné.

### Deux groupes, deux objectifs différents

La distinction compte, et elle n'est pas cosmétique. Le premier groupe vise **la
durée** d'une pause ; le second **sa fréquence**. Une pause de 50 ms qui revient
trois fois par seconde coûte plus cher qu'une pause de 50 ms toutes les dix
secondes, et aucun drapeau du premier groupe n'agit sur ce point.

#### Pauses courtes (six drapeaux)

| Drapeau | Défaut | Effet |
|---|---|---|
| `-XX:+UseG1GC` | déjà actif | Le ramasse-miettes à pauses courtes. Explicite pour que la suite ait un sens. |
| `-XX:+ParallelRefProcEnabled` | off | Traite en parallèle les références faibles, dont le jeu fait un usage massif pour ses textures et ses morceaux de terrain. |
| `-XX:+DisableExplicitGC` | off | Rend sans effet les appels à `System.gc()`. Certains mods en font, et chacun gèle le jeu une demi-seconde sans cause visible à l'écran. |
| `-XX:+PerfDisableSharedMem` | off | Empêche la JVM d'écrire son fichier de statistiques sur le disque. Quand le disque hoquette, cette écriture bloque la machine virtuelle entière : c'est une cause connue de micro-freezes inexplicables. |
| `-XX:MaxGCPauseMillis=50` | 200 | À soixante images par seconde, une image dure seize millisecondes : **une pause de 200 ms en fait tomber douze d'affilée**. On échange un peu de débit contre des pauses plus courtes, ce qui est exactement le compromis d'un jeu et non d'un serveur. |
| `-XX:G1HeapRegionSize=8M` | 2M à 4 Go | Avec quatre gigaoctets, G1 choisit des régions de deux mégaoctets, et tout objet dépassant un mégaoctet devient « énorme » : il n'est ramassé qu'aux collectes complètes. Les tableaux de sections de terrain franchissent ce seuil ; des régions de huit mégaoctets le repoussent. |

#### Pauses rares (quatre drapeaux)

| Drapeau | Défaut | Effet |
|---|---|---|
| `-XX:G1ReservePercent=20` | 10 | La réserve que G1 garde pour ne pas tomber à court pendant une évacuation. Quand elle ne suffit pas, l'évacuation échoue et G1 se rabat sur une collecte complète — le gel long, celui qui fait perdre un combat. La doubler coûte un peu de tas et achète cette garantie. |
| `-XX:G1RSetUpdatingPauseTimePercent=5` | 10 | Part de chaque pause consacrée à la mise à jour des ensembles mémorisés. En la réduisant, ce travail part vers les fils concurrents et la pause raccourcit d'autant. Va dans le même sens que `MaxGCPauseMillis=50`. |
| `-XX:InitiatingHeapOccupancyPercent=15` | 45 | Taux de remplissage à partir duquel G1 commence son marquage concurrent. **À ne pas confondre avec ce qu'en disent les guides** : `G1UseAdaptiveIHOP` reste actif — vérifié par `PrintFlagsFinal`, le drapeau vaut toujours `true` une fois celui-ci posé — donc cette valeur ne sert que de point de départ, le temps que G1 ait observé assez de collectes pour décider lui-même. Son intérêt est donc précis et limité : les premières minutes, pendant le chargement du monde, où une collecte complète déclenchée trop tard coûte plusieurs secondes. |
| `-XX:+AlwaysPreTouch` | off | Fait réserver tout le tas initial au démarrage, au lieu de laisser le système l'accorder page par page en pleine partie. On perd une à deux secondes au lancement, on gagne de ne plus attendre le système au premier combat. |

### Deux règles qui ne sont pas négociables

**Aucun drapeau expérimental.** Détail en 1.6.

**Changer de ramasse-miettes remplace le jeu de drapeaux, il ne s'y ajoute pas.**
Détail en 3.6.

### Où vivent ces drapeaux, et pourquoi ils ont déménagé

Ils vivaient dans la valeur par défaut de `settings.jvmArgs`, donc dans un champ
que le joueur peut éditer. Deux problèmes :

1. Le champ était enregistré avec cette valeur, donc un joueur qui n'y avait
   jamais touché portait quand même « ses » drapeaux, et les faire évoluer
   demandait une migration à chaque fois.
2. Surtout : **le bon jeu de drapeaux dépend de la version de Java**, alors que le
   champ est unique et global.

La fonction `tuningFlags(javaMajor)` prend donc le majeur en paramètre. Aujourd'hui
il ne sert à rien, et c'est un résultat, pas un oubli : les dix drapeaux sont
tous `product` et valides sur 21 comme sur 25. Le paramètre est là parce que la
sonde de CI s'en sert pour éprouver la liste majeur par majeur, et parce que le
jour où une valeur devra différer, c'est là que la distinction se fera.

Le champ du joueur reste, vide par défaut, et **ses arguments viennent après les
nôtres** sur la ligne de commande : sur un `-XX:Flag=valeur` répété, c'est le
dernier qui gagne. Il peut donc corriger n'importe lequel des nôtres sans qu'on
ait à prévoir le cas.

Une migration silencieuse (`estUnAncienDefaut`) vide le champ des joueurs qui
portaient l'ancienne valeur par défaut sans jamais l'avoir choisie ; celui qui a
saisi ses propres arguments les conserve.

**Réserve connue :** si le joueur impose son propre chemin Java dans les
paramètres, le majeur réellement lancé peut ne pas être celui qu'on a déduit. Ce
n'est pas un problème tant que la liste est identique partout ; le jour où elle se
scindera, il faudra interroger le binaire.

## 1.6 Les trois drapeaux qui empêchent le jeu de démarrer

Ce paragraphe est le plus important de la partie I, parce qu'il documente une
erreur évitée de justesse.

Trois drapeaux figurent dans à peu près tous les guides de réglage Minecraft :

```
-XX:G1NewSizePercent
-XX:G1MaxNewSizePercent
-XX:G1MixedGCLiveThresholdPercent
```

Ils ont été recommandés, écrits, puis donnés à un vrai JDK 21 avant d'être
publiés. Réponse de la JVM :

```
is experimental and must be enabled via -XX:+UnlockExperimentalVMOptions
```

**La JVM refuse de démarrer.** Pas un réglage qui se dégrade : un jeu qui ne se
lance plus, chez tous les joueurs, à la première mise à jour.

On pourrait ajouter `-XX:+UnlockExperimentalVMOptions`. On ne le fait pas, pour
une raison qui tient à ce projet précisément : **un drapeau expérimental peut
disparaître d'un majeur à l'autre sans préavis, et ce launcher en couvre deux**
(21 et 25). Un jeu qui démarre sur 1.21.11 et refuse de démarrer sur 26.1 serait
un défaut très difficile à diagnostiquer pour un joueur.

La leçon a été transformée en test. `test-jvm-flags.ts` :

- donne **chaque drapeau un par un** à un vrai `java -version` ;
- donne ensuite **la liste entière** avec la mémoire réelle du launcher ;
- vérifie qu'**aucun drapeau n'ouvre les options expérimentales** ;
- vérifie que `-XX:+UseZGC` posé par-dessus fait bien échouer l'initialisation ;
- retire `JAVA_TOOL_OPTIONS` de l'environnement, pour mesurer ce que font nos
  drapeaux, seuls.

Et le workflow le lance **une fois par majeur que le launcher peut choisir** :

```yaml
for major in 21 25; do
  home_var="JAVA_HOME_${major}_X64"
  ...
  JAVA_BIN="$home/bin/java" pnpm --filter @paranoia/backend test:jvm
done
```

Il échoue plutôt que de sauter un majeur absent : un saut silencieux recréerait
exactement l'aveuglement que ce banc existe pour supprimer.

## 1.7 La priorité du processus

**Fichier :** `apps/backend/src/modules/launcher/launcher.service.ts`

Une fois le jeu lancé, le launcher élève la priorité de son processus :

```ts
os.setPriority(proc.pid, os.constants.priority.PRIORITY_HIGH);
```

Ce que ça fait : demande à l'ordonnanceur du système de servir Minecraft avant
les autres processus prêts. Sur une machine où un navigateur, Discord et un
logiciel de capture tournent en même temps — c'est-à-dire sur la machine de
n'importe quel joueur de PvP — cela réduit les moments où le jeu attend son tour.

Ce que ça ne fait pas : créer du temps de calcul. Sur une machine au repos, le
gain est nul.

L'échec est non fatal et journalisé : selon le système et les droits, l'appel peut
être refusé, et un jeu qui tourne à priorité normale est un jeu qui tourne.

## 1.8 La version de Java, imposée par Mojang

**Fichier :** `apps/backend/src/modules/launcher/javaRequirement.ts`

La version de Java n'est pas un choix de performance, c'est une contrainte : elle
est lue dans les métadonnées de Mojang, où chaque version de Minecraft porte son
`javaVersion.majorVersion`.

| Version de Minecraft | Java |
|---|---|
| 1.21.x | 21 |
| 26.x | 25 |

Le launcher télécharge le runtime correspondant si le joueur n'impose pas son
propre chemin. Une version future qui demanderait Java 27 est gérée sans toucher
au code : c'est la métadonnée qui décide. Une table de secours couvre le cas
hors-ligne.

Cela compte pour l'optimisation par un détour : c'est cette version qui décide
quels drapeaux JVM sont valides (1.5), et c'est pour ça que `tuningFlags` prend le
majeur en paramètre.

## 1.9 La mémoire allouée

**Fichier :** `apps/backend/src/modules/settings/settings.store.ts`

| Réglage | Défaut | Bornes |
|---|---|---|
| `ramMinMb` | 2 048 | 512 – 65 536 |
| `ramMaxMb` | 4 096 | 512 – 65 536 |

La RAM du profil, si elle est renseignée, prime sur celle des paramètres. Le
minimum effectif ne dépasse jamais le maximum : `min(settings.ramMinMb, max)`.

Quatre gigaoctets est un choix, pas une limite technique. Plus de tas ne veut pas
dire plus d'images : un tas très grand allonge les collectes complètes, ce qui va
contre tout ce que fait la section 1.5. C'est aussi ce qui justifie
`G1HeapRegionSize=8M`, calculé pour ce volume.

## 1.10 Le démarrage du launcher lui-même

Trois gains, dont un qui n'était pas de la lenteur mais un mensonge d'interface.

**Un écran qui disait le contraire de ce qui se passait.**
`useAuth` exposait `restoringSession` et personne ne le lisait : pendant que le
jeton Microsoft se renouvelait — un aller-retour jusqu'à `login.live.com` —
l'écran « Connexion requise » s'affichait à un joueur déjà connecté, puis
basculait tout seul. On attendait devant un écran qui annonçait l'inverse de la
vérité. Il compte désormais comme un chargement.

**Les trois requêtes de démarrage partent ensemble.**
`apps/launcher/src/app/hooks/useBootstrap.ts` :

```ts
const [remoteConfig, latestNews] = await Promise.all([
  fetchRemoteConfiguration(),
  fetchNews().catch(() => [] as NewsItem[]),
  refreshProfiles(),
]);
```

Les actualités partaient après le catalogue et les profils alors qu'elles n'en
dépendent pas : leur aller-retour s'ajoutait tel quel au temps de démarrage. Et
leur échec ne fait plus échouer le démarrage — un fil injoignable renvoyait le
joueur sur l'écran d'erreur, alors que le launcher marche très bien avec un
bandeau vide.

**L'attente du service local, resserrée au début.**
`apps/launcher/src/shared/api/http.ts` :

```ts
let delay = 50;
// ...
delay = Math.min(delay * 1.5, 400);
```

À 250 ms fixes, un backend prêt en 310 ms faisait attendre jusqu'à 500 : on payait
un quart de seconde d'attente pure à chaque démarrage, pour rien. Les premiers
essais sont rapprochés et l'écart grandit ensuite — inutile de marteler un service
qui met visiblement du temps.

## 1.11 Les téléchargements

**Fichiers :** `artifactDownloader.ts`, `verifiedDownload.ts`

Trois points qui relèvent autant de la sûreté que de la vitesse :

**Réutilisation par empreinte.** Un fichier déjà présent n'est réutilisé que si
son `sha256` correspond. La taille seule laissait passer un fichier corrompu ou
substitué ; l'empreinte évite aussi un retéléchargement inutile après un
lancement interrompu.

**`maxSockets: 6`** sur les téléchargements de MCLC. Un compromis : assez de
parallélisme pour saturer une connexion domestique, assez peu pour éviter les
délais d'attente et les `EMFILE`.

**`resolveInsideRoot`.** Les chemins viennent de catalogues distants : un
`../../` fabriqué écrirait n'importe où dans le système. Tout chemin qui sort du
dossier d'installation est refusé. HTTPS est exigé.

---
---

# Partie II — Dans le jeu : le mod client

## 2.1 Ce que le mod optimise, et ce qu'il ne touche pas

Le mod client est un mod Fabric, construit pour plusieurs versions de Minecraft,
et il travaille sur quatre postes que Sodium ne couvre pas :

| Poste | Module | Défaut |
|---|---|---|
| naissance des particules | `ParticleBudgetModule` | désactivé |
| rendu des entités lointaines | `EntityCullingModule` | désactivé |
| rendu des blocs animés | `BlockEntityCullingModule` | désactivé |
| images par seconde hors focus | `FocusFpsModule` | désactivé |

Auxquels s'ajoutent trois optimisations qui ne sont pas des modules, parce
qu'elles ne retirent rien et n'ont donc pas à être choisies :

| Poste | Où | Toujours actif |
|---|---|---|
| appels de dessin du HUD | `render/Shapes.java` | oui |
| recalculs du HUD par image | `hud/HudElement.java` | oui |
| mémoire graphique des cosmétiques | `cosmetics/CosmeticTextures.java` | oui |

Et une optimisation de combat, active par défaut parce qu'elle ne parie sur rien :

| Poste | Module | Défaut |
|---|---|---|
| attente du serveur après un crystal frappé | `CrystalCleanupModule` | **activé** |

### Pourquoi les quatre premiers sont désactivés par défaut

Ce sont des compromis visuels, et **un compromis ne s'impose pas** : le joueur qui
le veut va le chercher. Ils sont rangés ensemble dans un onglet « Optimisation »,
pour deux raisons :

1. Ils étaient introuvables quand on cherche des images par seconde, rangés entre
   la luminosité et le badge.
2. Rien ne signalait qu'ils partagent une nature : ce sont les seuls modules du
   mod qui retirent quelque chose à l'écran. Les regrouper permet de voir d'un
   coup d'œil **tout ce qu'on a accepté de sacrifier**.

Le panneau de diagnostic les rejoint dans cet onglet : un instrument se cherche
avec ce qu'il mesure.

### Le principe commun aux trois modules de rendu

Les trois s'accrochent à l'endroit où **le jeu lui-même décide** si quelque chose
mérite d'être dessiné :

| Module | Point d'accroche | Ce que le jeu y fait déjà |
|---|---|---|
| entités | `EntityRenderer.shouldRender` | son propre test de champ de vision |
| blocs animés | `BlockEntityRenderer.isInRenderDistance` | son propre test de distance (64 blocs) |
| particules | `ParticleManager.addParticle` | l'entonnoir par lequel toutes les particules naissent |

La conséquence est ce qui rend ces modules intéressants : **l'entité écartée ne
coûte ni état de rendu, ni modèle, ni sommet.** On ne l'accélère pas, on ne la
produit pas.

Et une règle que les trois respectent : **ils ne répondent jamais `true`,
uniquement `false`.** Vanilla garde donc le dernier mot sur tout le reste, et
aucun de ces mixins ne peut faire apparaître quelque chose que le jeu aurait
caché.

## 2.2 Le budget de particules

**Fichiers :** `modules/ParticleBudgetModule.java`, `mixin/ParticleManagerMixin.java`

### Ce n'est pas « moins de particules »

Le jeu tient sans effort le flux ordinaire : pluie, fumée, pas de course. Ce qui
le met à genoux, c'est **la rafale** : une explosion de cristal fait naître des
centaines de particules dans le même tick, et c'est cette pointe, pas la moyenne,
qui fait tomber le framerate **au moment précis où le joueur en a besoin**.

En crystal PvP, ce moment-là est le seul qui compte.

On refuse donc les naissances au-delà d'un plafond par tick, et on laisse passer
tout le reste. Le joueur garde son retour visuel — les premières particules d'une
explosion sont celles qu'il voit — sans payer les centaines suivantes qui se
superposent au même endroit.

### Refuser la naissance, pas le dessin

C'est délibérément plus radical, et c'est le bon choix : **une particule non née ne
coûte ensuite ni tick, ni collision, ni sommet.** Une particule dont on saute
seulement le dessin continue d'être mise à jour, de se déplacer, de tester ses
collisions.

### Le réglage

| Réglage | Défaut | Bornes | Pas |
|---|---|---|---|
| Particules par tick | **256** | 32 – 2 048 | 32 |

Deux cent cinquante-six laisse passer une explosion entière de taille ordinaire et
n'écrête que les rafales vraiment hors norme. Le curseur descend jusqu'à
trente-deux pour les configurations modestes.

### Deux détails d'implémentation

**Le compteur s'incrémente même au-delà du plafond.** Sans cela il resterait collé
à la limite, et le premier tick suivant repartirait faux.

**La variante à coordonnées de `addParticle` n'est volontairement pas touchée.**
Elle rend une `Particle` : l'annuler obligerait à rendre `null` à des appelants
dont rien ne garantit qu'ils s'y attendent. La variante interceptée ne rend rien,
l'annuler n'a donc aucun effet de bord — et la sonde confirme que **tout passe par
elle**, y compris ce que produit la variante à coordonnées. Un seul point
d'accroche suffit donc à tout couvrir.

### La mesure en jeu

`Rate dropped` compte ce que le plafond a réellement écarté, et le panneau de
diagnostic l'affiche en « particules écartées par seconde ». Un zéro obstiné
pendant une explosion veut dire que le plafond est trop haut pour mordre ; un
chiffre à quatre chiffres veut dire qu'il mord beaucoup.

## 2.3 L'allègement du décor lointain

**Fichiers :** `modules/EntityCullingModule.java`, `mixin/EntityRendererCullingMixin.java`

### Le constat

Dans une base pleine d'objets au sol, ce ne sont pas les murs qui font tomber le
framerate : **c'est le nombre**. Chaque objet au sol tourne sur lui-même et se
dessine entièrement, chaque orbe d'expérience aussi, et il en traîne des centaines
après n'importe quel combat. À quarante blocs, aucun d'eux ne représente plus de
trois pixels à l'écran.

### La règle qui ne se négocie pas

> **Aucun être vivant n'est jamais écarté pour cause de distance.**

En PvP, un adversaire qu'on ne voit pas parce que le client a décidé de
l'économiser est le pire défaut possible — pire que n'importe quelle chute de
framerate. La distance ne s'applique donc qu'à ce qui ne rend jamais un coup.

Le code écrit cette règle deux fois, exprès :

```java
// PlayerEntity figure ici alors que LivingEntity suffirait, et c'est
// voulu: si la hierarchie de Minecraft change un jour, le joueur reste
// protege par son propre test.
if (entity instanceof PlayerEntity || entity instanceof LivingEntity) {
```

### Les réglages

| Réglage | Défaut | Bornes | Nature |
|---|---|---|---|
| Objets au sol au-delà de | **32 blocs** | 8 – 128 | décor |
| Orbes d'expérience au-delà de | **24 blocs** | 8 – 128 | décor |
| Inclure les porte-armures | **non** | — | décor, sur demande |
| Porte-armures au-delà de | 48 blocs | 8 – 128 | décor |
| Ignorer ce qui est derrière un mur | **non** | — | occlusion |
| Occlusion au-delà de | 12 blocs | 4 – 64 | occlusion |
| Inclure joueurs et créatures (occlusion seule) | **non** | — | voir 2.4 |
| Joueurs et créatures au-delà de | 20 blocs | 8 – 64 | voir 2.4 |

### Pourquoi les porte-armures sont exclus par défaut

Ils ne rendent aucun coup, donc ils relèvent techniquement du décor. Mais ce sont
des objets de décoration sur la plupart des serveurs et **des repères sur
d'autres** : affichage de boutique, marqueur de zone, texte flottant. Les faire
disparaître sans prévenir casserait ces usages. D'où un réglage séparé.

### La question avant le calcul

Le mixin mesurait la distance de chaque entité à la caméra **avant même de savoir
si le module était actif** — et il est désactivé par défaut, donc tout le monde
payait ce calcul pour rien, à chaque image, pour chaque entité.

```java
if (!EntityCullingModule.active()) {
    return;
}
double squared = entity.squaredDistanceTo(cameraX, cameraY, cameraZ);
```

C'est peu de chose par entité ; ce n'est plus rien du tout quand on n'allume
jamais la fonction. Le même garde a été ajouté au mixin des blocs animés.

## 2.4 L'occlusion, et ses sept garde-fous

**Fichier :** `modules/EntityVisibility.java`

C'est la partie la plus délicate du mod, parce que c'est la seule qui peut faire
disparaître un adversaire. Elle est donc entourée de plus de précautions que tout
le reste réuni.

### Le principe

Un rayon part de la caméra vers l'entité : s'il rencontre un cube plein et opaque
avant de l'atteindre, elle est cachée. Tout le reste du fichier consiste à rendre
la question **assez bon marché pour qu'elle coûte moins cher que la réponse**.

### Garde-fou 1 : « opaque » au sens strict

Le premier jet tirait un rayon de collision et tenait pour bouché tout ce qui
l'arrêtait. C'était suffisant pour du décor et **inutilisable pour un joueur** :
une vitre, une trappe, une feuille arrêtent un rayon de collision sans rien
cacher, et l'adversaire qu'on voit parfaitement aurait disparu.

On parcourt donc les blocs traversés un par un et on ne s'arrête qu'au premier
cube plein et opaque. `isOpaqueFullCube` est exactement la question posée : le
bloc remplit-il son cube, et la lumière s'y arrête-t-elle. Le verre, les
feuillages, les dalles, les escaliers et les clôtures répondent non.

Cette version est à la fois **plus correcte et moins chère** que la précédente,
qui allait chercher la forme de collision de chaque bloc.

### Garde-fou 2 : neuf rayons, le centre d'abord

Le centre en premier : une entité bien en vue coûte alors **un seul rayon**, et
c'est le cas le plus fréquent. Les huit coins ensuite, qui rattrapent l'entité
dont seule une extrémité dépasse d'un mur.

Les quatre coins **hauts** sont testés avant les bas, et c'est une optimisation
mesurée sur le cas réel : ce qui dépasse d'un obstacle dépasse presque toujours
par le haut — une tête au-dessus d'un mur, un adversaire en surplomb, un objet sur
un rebord. L'ordre précédent parcourait les quatre coins bas d'abord, donc **le cas
qui compte le plus coûtait cinq rayons là où il en faut deux**.

Les coins sont rentrés d'un centième : pile sur l'arête, le rayon frotte le bloc
voisin et rapporte un contact qui n'existe pas.

### Garde-fou 3 : des durées de validité asymétriques

C'est la correction la plus subtile du fichier. Les deux réponses ne se valent
pas, et les traiter pareil était une erreur.

- Une entité **cachée** n'est pas dessinée. Si elle réapparaît et qu'on ne le sait
  pas encore, **le joueur ne voit pas quelque chose qu'il devrait voir**. Il faut
  redemander vite.
- Une entité **visible** est déjà dessinée. Si elle passe derrière un mur et qu'on
  ne le sait pas encore, on dessine quelque chose en trop pendant un instant : on
  perd un peu d'économie, **on ne se trompe sur rien**. On peut redemander bien
  plus tard.

| | cachée | visible |
|---|---|---|
| décor | 250 ms | 750 ms |
| être vivant | **50 ms** (un tick) | 200 ms |

Les 50 ms sont le chiffre le plus important du fichier. Un quart de seconde de
mémoire sur un objet au sol ne se voit pas ; la même mémoire sur un joueur qui
sort d'un mur, c'est cinq ticks pendant lesquels un adversaire bien visible reste
effacé. En duel, ce défaut coûte plus cher que tout ce que l'allègement peut
rapporter.

Relâcher les entités visibles n'est pas qu'une économie de calcul : le budget par
tick est plafonné, et les entités franchement visibles sont de loin les plus
nombreuses. Tant qu'elles se faisaient réinterroger au même rythme que les autres,
**elles consommaient le budget que les entités jamais testées attendaient**. Les
relâcher étend la couverture du module sans rien accélérer et sans toucher au
délai de réapparition, qui est le seul qui se voie.

### Garde-fou 4 : deux budgets séparés

| Budget | Par tick |
|---|---|
| décor | 24 nouveaux calculs |
| êtres vivants | 32 nouveaux calculs |

**Par tick et non par image**, parce que c'est de là que vient l'appel. La
différence n'est pas cosmétique : le coût est ainsi plafonné à vingt-quatre
calculs vingt fois par seconde **quelle que soit la fluidité**, au lieu de grimper
avec elle. À cent vingt images par seconde, ces vingt-quatre calculs se
répartissent sur six images au lieu d'être refaits à chaque fois.

**Séparés, et pas seulement plus grands** : si les joueurs puisaient dans le même
budget que le décor, une base pleine d'objets au sol pourrait le vider avant qu'un
seul adversaire ait été testé — ou l'inverse. Les deux populations n'ont ni la même
taille ni la même urgence.

**Conséquence à connaître :** au-delà d'environ cent vingt entités candidates
simultanées, toutes ne sont pas testées dans la durée de vie d'une réponse, et les
non testées **restent affichées**. L'allègement est alors partiel — jamais faux,
seulement incomplet, ce qui est le bon sens dans lequel se tromper.

### Garde-fou 5 : un cache qui n'alloue rien

Le premier jet utilisait une `HashMap<Integer, Entry>`. Elle était correcte et
coûteuse pour une raison invisible à la lecture : **la clé est un `int`, et `get`
prend un `Object`**. Chaque consultation emballait donc l'identifiant dans un
`Integer` neuf — au-delà de 127, le cache de la JVM ne sert plus à rien. Une base
pleine d'objets au sol produisait **des milliers d'objets jetables par seconde,
exactement dans le module censé en économiser**.

Trois tableaux parallèles de 2 048 cases règlent ça :

```java
private static final int[] slotEntity = new int[SLOTS];
private static final long[] slotCheckedAt = new long[SLOTS];
private static final boolean[] slotVisible = new boolean[SLOTS];
```

Rien n'est alloué, la mémoire est bornée une fois pour toutes, et le balayage
périodique qui empêchait la table de grossir toute la partie n'a plus de raison
d'être : une entité disparue laisse une case que la suivante reprendra.

2 048 est une puissance de deux, donc le modulo devient un ET binaire. Les
identifiants sont dispersés par `id ^ (id >>> 16)` : les entités nées ensemble
portent des identifiants consécutifs — une pile d'objets lâchée à la mort d'un
joueur — et mélanger les bits hauts évite que deux vagues espacées de 2 048
naissances se marchent systématiquement dessus.

Deux entités peuvent tomber sur la même case. La perdante est recalculée au
passage suivant, sans conséquence : le budget plafonne déjà ce travail, et la
réponse rendue entre-temps est « visible », le côté sur lequel on a le droit de se
tromper.

### Garde-fou 6 : le `Vec3d` de la caméra mémorisé

`raycast` demande un `Vec3d`. La caméra ne bouge pas pendant une image : sans
mémoire, chaque entité testée en allouait un identique au précédent. Il est
reconstruit seulement quand ses coordonnées changent.

### Garde-fou 7 : en cas de doute, on affiche

Une entité jamais testée, un budget épuisé, un monde absent, un bloc dans un
morceau non chargé : **tous ces cas rendent « visible »**. Le défaut penche du
côté où l'on dessine quelque chose en trop, jamais du côté où l'on escamote
quelque chose qu'il fallait voir.

### Le réglage qui peut faire disparaître un adversaire

`occludeLiving` — « Inclure joueurs et créatures » — est **désactivé par défaut et
doit le rester pour quiconque n'a pas vérifié le comportement sur son propre
serveur**. Trois choses le rendent défendable, et elles sont écrites sur le
réglage lui-même :

1. le test ne s'arrête qu'aux cubes pleins et opaques — une vitre, une trappe ou
   un feuillage ne cache personne ;
2. la réponse n'est gardée qu'un tick, contre 250 ms pour le décor ;
3. neuf rayons sont tirés vers la boîte entière, et un seul qui passe suffit à
   garder l'adversaire affiché — une épaule qui dépasse le maintient visible.

Et la distance minimale est plus haute que pour le décor (20 blocs contre 12),
pour une raison de combat : à bout portant, la moindre erreur du test se paie
immédiatement. Au-delà de vingt blocs, un adversaire entièrement derrière un mur
plein n'est pas en train de porter un coup.

> **Un gain de framerate ne vaut jamais un adversaire manqué.**

## 2.5 Les blocs animés

**Fichiers :** `modules/BlockEntityCullingModule.java`, `mixin/BlockEntityRendererCullingMixin.java`

### Le constat

Coffres, panneaux, bannières, shulkers, enclumes de réparation : ceux-là **ne sont
pas dessinés avec le reste du terrain**. Chacun a son propre rendu, appelé
individuellement, avec son modèle et ses matrices. Dans une base où il y en a
trois cents, c'est une dépense qui ne ressemble en rien à celle des blocs
ordinaires — et elle se paie à chaque image.

C'est aussi pour cela que Sodium ne les couvre pas : ils ne passent pas par le
rendu du terrain qu'il remplace.

### Ce que le module fait, et rien de plus

Le jeu les écarte déjà au-delà de soixante-quatre blocs. Le module **abaisse ce
seuil**, ce qui est tout ce qu'on peut lui demander : à trente-deux blocs, un
panneau est illisible et une bannière est une tache.

| Réglage | Défaut | Bornes |
|---|---|---|
| Blocs animés au-delà de | **32 blocs** | 8 – 64 |

### La protection des balises

> **Ce qui a demandé à être vu de loin garde sa portée.**

Une balise réclame deux cent cinquante-six blocs pour que son rayon reste visible
à l'autre bout de la carte ; un portail de l'End, un conduit, ont leurs propres
exigences. Des serveurs entiers sont bâtis sur ces repères.

Le module ne touche donc qu'aux rendus qui se contentent de la portée ordinaire,
et `getRenderDistance` fournit exactement cette distinction :

```java
private static final int ORDINARY_DISTANCE = 64;
// ...
if (vanillaDistance > ORDINARY_DISTANCE) {
    return false;
}
```

Sans cette règle, abaisser le seuil aurait fait disparaître le rayon des balises.

### La distance prise depuis le centre du bloc

`pos.getX() + 0.5`, et non le coin : à la limite du seuil, l'écart d'un demi-bloc
suffirait à faire clignoter un coffre quand on avance.

### `require = 0` : la seule dérogation du dépôt

Tout le reste du mod injecte avec `defaultRequire: 1` — une cible disparue doit se
voir bruyamment au démarrage plutôt que de produire un mod à moitié fonctionnel.
Cette injection déroge à la règle, pour une raison précise.

C'est la première du dépôt à viser la **méthode par défaut d'une interface** et non
le corps d'une classe. Si mixin refusait cette construction, la règle habituelle
empêcherait le jeu de démarrer — **chez tous les joueurs, y compris ceux qui n'ont
jamais activé le module**, puisqu'un mixin s'applique indépendamment des réglages.

> Faire dépendre le démarrage du jeu d'un confort de framerate serait un mauvais
> échange.

Le pire cas devient donc : la fonction ne fait rien. Et pour que ce silence ne
passe pas inaperçu, **le module compte ce qu'il écarte et le panneau de diagnostic
l'affiche** : un compteur qui reste à zéro alors que le module est actif et qu'on
est entouré de coffres est la preuve que l'injection n'a pas pris.

C'est le seul endroit du dépôt où une optimisation a le droit d'échouer en
silence, et il est doublé d'un instrument de mesure pour cette raison exacte.

## 2.6 Le ralentissement hors focus

**Fichiers :** `modules/FocusFpsModule.java`, `mixin/InactivityFpsLimiterMixin.java`

### Le trou que ça comble

Minecraft possède déjà un limiteur d'inactivité, et il fait l'essentiel du
travail : fenêtre réduite, menu ouvert, et deux paliers après une longue absence
de saisie. Mais **il se déclenche sur l'inactivité, pas sur le focus**. Basculer
sur Discord laisse donc le jeu dessiner à pleine vitesse pendant une bonne minute,
pour une fenêtre que personne ne regarde.

| Réglage | Défaut | Bornes |
|---|---|---|
| Images par seconde hors focus | **30** | 5 – 120 |

### La valeur ne fait que baisser celle du jeu

```java
return Math.min(vanillaLimit, module.limit.getInt());
```

Quand vanilla est déjà plus strict — fenêtre réduite, absence prolongée — c'est
vanilla qui gagne. **On ne peut donc pas, par ce réglage, rendre le jeu plus
gourmand qu'il ne l'aurait été.**

### Pourquoi s'accrocher au limiteur plutôt que piloter le réglage du joueur

Deux ennuis évités :

1. On n'écrit rien dans ses options — un plantage pendant qu'il est ailleurs ne
   lui laisserait pas un jeu bridé au redémarrage.
2. On hérite de tout ce que vanilla décide déjà.

### Pourquoi désactivé par défaut

Pas par prudence de principe : **quelqu'un qui diffuse sa partie garde la fenêtre
du jeu capturée pendant qu'il travaille ailleurs.** Brider à trente images par
seconde ruinerait son direct sans qu'il comprenne pourquoi.

## 2.7 Le HUD : le coût qu'on croyait négligeable

**Fichier :** `render/Shapes.java`

### Le commentaire qui se trompait

Le commentaire de ce fichier disait le coût négligeable. **Il ne l'était pas.**

`DrawContext` ne connaît que `fill` : un rectangle aligné sur les axes, sans rayon
ni antialiasing. Un coin rond se compose donc à la main, une rangée de pixels à la
fois — ce qui tombe bien, c'est exactement l'esthétique du jeu.

Mais un contour demandait **une à deux `fill` par rangée de pixels** :

- 102 appels pour le cadre d'un élément de cinquante-deux pixels de haut ;
- 38 appels pour une touche du clavier — et la grille en compte sept.

Une image de HUD complète demandait **1 040 appels de dessin**, soit **un quart de
million par seconde à 240 images**.

### L'observation qui change tout

Les rangées voisines sont presque toutes identiques. Un arc n'a que quelques
retraits distincts — `INSETS[5]` vaut 3, 1, 1, 0, 0, donc cinq rangées ne font que
trois bandes — et tout le milieu d'un contour est **le même trait droit répété
quarante fois**.

Les deux fonctions émettent donc **une bande par suite de rangées identiques**, au
lieu d'une par rangée.

### La mesure, sur les formes réelles du HUD

| Forme | Avant | Après |
|---|---|---|
| carte d'élément (fond) | 11 | 5 |
| carte d'élément (contour) | 102 | **12** |
| touche du clavier (fond) | 9 | 5 |
| touche du clavier (contour) | 38 | **8** |
| fenêtre du menu (fond) | 13 | 7 |
| **une image de HUD complète** | **1 040** | **218** |

Soit **79 % d'appels de dessin en moins**, à l'image près.

### Au pixel près, et ce n'est pas une façon de parler

Les deux versions ont été rejouées sur **93 600 formes** — toutes les tailles de 1
à 60 croisées avec les rayons de 0 à 8 — et comparées **pixel par pixel**. Zéro
écart.

La comparaison porte sur **la multiplicité de chaque pixel** et pas seulement sur
sa couverture, parce qu'avec une couleur translucide un pixel peint deux fois est
plus foncé, et que l'ancien `roundedOutline` évitait ce recouvrement exprès.

### Deux détails du regroupement

**Dans `rounded`**, les rangées d'arc à retrait nul se fondent d'elles-mêmes dans
le corps, qui a le même retrait. C'est tombé tout seul en formulant le parcours par
bandes, sans cas particulier.

**Dans `roundedOutline`**, le groupement porte sur les **trois** valeurs qui
décrivent une rangée — retrait, épaisseur, et le cas étroit — et pas seulement sur
le retrait : deux rangées de même retrait mais d'épaisseur différente ne dessinent
pas la même chose.

### Ce qui n'a pas été touché, après mesure plutôt que supposition

La mesure du texte. `width()` et `height()` ne sont appelés qu'une fois chacun par
image dans le chemin de jeu — le second appel vient de `bounds()`, qui ne sert
qu'à l'éditeur — et les chaînes font trois ou quatre caractères. Le garde-fou par
image et la mise en cache des textes dans les champs étaient déjà en place et font
leur travail.

C'est la bonne façon de conclure une optimisation : dire aussi ce qu'on a mesuré
et laissé tranquille.

### Le garde-fou par image

**Fichier :** `hud/HudElement.java`

`width`, `height`, `visibleInGame` et `renderContent` sont appelés chacun au moins
une fois par image, et parfois davantage : mesurer une colonne demande de parcourir
les mêmes lignes que les dessiner.

```java
public final void prepare() {
    if (preparedFor == frame) {
        return;
    }
    preparedFor = frame;
    refresh();
}
```

Sans ce garde-fou, un panneau d'informations reconstruit six fois par image une
liste que le joueur ne voit qu'une fois — soit, à 240 images par seconde,
**un millier et demi de listes jetées chaque seconde pour afficher six lignes de
texte**.

### Les textes gardés dans des champs

Chaque élément ne reformate sa chaîne que lorsque son chiffre change. Le compteur
d'images du jeu ne bouge qu'une fois par seconde : le formater à chaque image
reviendrait à **jeter deux cent trente-neuf chaînes sur deux cent quarante, toutes
identiques**.

Le panneau de diagnostic applique la même règle à ses six valeurs — « le panneau
qui mesure le gaspillage serait mal venu d'en produire » — et réutilise ses objets
`Line` d'une image à l'autre au lieu d'en allouer.

### Le style de police, mémorisé une fois

`Style.withFont` ne prend pas le même type selon la version de Minecraft, donc sa
construction appartient à la plateforme. Sans mémoire statique, **chaque ligne de
chaque élément le redemanderait à chaque image**. Un seul style est construit,
reconstruit seulement quand la police choisie change.

## 2.8 Le crystal instantané

**Fichiers :** `modules/CrystalCleanupModule.java`,
`mixin/ClientPlayerInteractionManagerMixin.java`

C'est la seule optimisation de combat du mod, et la seule active par défaut.

### Le problème

Quand on frappe un end crystal, le serveur le détruit immédiatement, mais **le
client garde l'entité jusqu'à ce que le paquet de suppression lui revienne**. Or sa
boîte de collision occupe encore la place : impossible d'en poser un nouveau au
même endroit.

Le joueur attend donc **un aller-retour de ping complet par crystal**, alors que le
serveur a déjà tout traité.

| Ping | Crystals | Temps perdu |
|---|---|---|
| 40 ms | 5 | 200 ms |
| 80 ms | 5 | **~400 ms** |
| 150 ms | 5 | 750 ms |

Sur un burst, c'est la différence entre gagner et perdre l'échange.

> Ce n'est pas le réseau qui est en cause, **c'est le client qui est plus
> restrictif que le serveur**.

### Pourquoi c'est sûr, et non un pari

Un end crystal meurt de **n'importe quel** dégât : il n'a pas de points de vie à
entamer. Prédire sa disparition n'est donc pas une supposition, c'est une
certitude — dès lors que le coup atteint le serveur, et le jeu passe par TCP, donc
il l'atteint.

C'est ce qui distingue ce module d'une prédiction de combat ordinaire :
**on ne devine pas si le coup va tuer, on sait qu'il tue.**

### Ce que ce module n'est pas

Il ne frappe pas, ne pose pas, ne choisit pas la cible. Il ne donne **aucune
information** que le joueur n'aurait pas — le crystal qu'il efface est déjà
détruit. Il enlève une attente que le client s'imposait à lui-même, exactement
comme la synchronisation verticale coupée ou la limite d'images préparées en
avance, côté launcher.

L'auto-crystal, lui, frapperait à la place du joueur. Ce n'est pas la même chose et
ce n'est pas ici.

### Les quatre décisions techniques

**Sur `attackEntity` et non sur `MinecraftClient.doAttack`.** C'est ici que la
cible est connue et que le paquet part ; `doAttack` ne rend qu'un booléen et
laisserait à deviner ce qui a été frappé.

**En `TAIL`, donc après l'envoi.** L'ordre compte : retirer l'entité avant que le
paquet ne soit écrit serait retirer la cible du code qui s'en sert.

**Uniquement `EndCrystalEntity`.** C'est tout l'argument du module : eux seuls
meurent de n'importe quel dégât. Toute autre entité a des points de vie.

**`RemovalReason.KILLED` et non `DISCARDED`.** C'est la raison que le serveur
emploie pour un crystal détruit, et l'état local doit finir identique à celui
qu'aurait produit le paquet qu'on anticipe — sinon on aurait remplacé une attente
par une divergence.

Les signatures ont été lues par la sonde de la CI sur 1.21.8 et 1.21.11 avant
d'être écrites, et elles sont identiques : `attackEntity(PlayerEntity, Entity)`,
`ClientWorld.removeEntity(int, RemovalReason)`.

### La désynchronisation, assumée

Si le serveur refuse le coup — joueur hors de portée au moment où il le traite — le
crystal existe encore chez lui et plus chez le joueur, qui frappe alors dans le
vide jusqu'à ce qu'il sorte et revienne à portée.

Ce cas est **accepté plutôt que corrigé**, et c'est un choix documenté : restaurer
l'entité après un délai demanderait de deviner ce délai, ferait clignoter le
crystal, et corrigerait une fréquence qu'on ne connaît pas encore. Le module
s'éteint d'un clic ; on mesurera en jeu avant d'écrire du code contre une peur.

## 2.9 Les cosmétiques : une texture pour trente porteurs

**Fichier :** `cosmetics/CosmeticTextures.java`

Ce n'est pas une optimisation de framerate, c'en est une de mémoire graphique — et
la mémoire graphique saturée se paie en saccades.

### Le calcul

Une cape en haute définition — 1024×256, ce que le format autorise — pèse **un
mégaoctet en mémoire graphique** une fois envoyée à la carte. Charger la même cape
une fois par porteur, sur un serveur où trente joueurs arborent la cape légendaire
du moment, revient à occuper **trente mégaoctets pour afficher trente fois la même
image**.

Indexée par son adresse, elle n'est chargée qu'une fois.

### La durée de vie se compte en usage, pas en références

Un rendu ne peut pas garantir des prises et des relâchements appariés — un joueur
qui quitte le serveur ne prévient personne — alors qu'il redemande sa texture à
chaque image tant qu'il l'affiche. Une entrée que **plus personne n'a réclamée
depuis une minute** n'a donc plus de porteur visible, et sa mémoire est rendue.

Le balayage vit dans le cycle de présence : c'est le seul battement régulier qui
continue quand l'API est injoignable ou quand plus aucun porteur n'est visible,
c'est-à-dire justement quand il y a de la mémoire à rendre.

### Deux plafonds, et pourquoi il en fallait deux

| Plafond | Valeur | Ce qu'il protège |
|---|---|---|
| octets téléchargés | 4 Mo | un fichier qui n'aurait rien à faire là |
| définition | **2048×1024** | la mémoire graphique |

Le plafond d'octets **ne protège pas** de la mémoire vidéo : une image de couleurs
plates se compresse énormément, et quatre mégaoctets de PNG peuvent en donner dix
fois plus une fois dépliés. Le plafond précédent, 4096×2048, laissait passer
**trente-trois mégaoctets de mémoire vidéo par cosmétique**. À 2048×1024, le pire
cas passe à huit.

Une cape vanilla mesure 64×32. À 2048×1024 on accepte encore trente-deux fois
cette définition dans chaque sens, ce qu'aucun cosmétique légitime n'atteindra.

### Trois fils, une frontière stricte

| Fil | Ce qu'il fait |
|---|---|
| rendu | appelle `get`, qui n'est qu'une lecture de champ : jamais d'attente, jamais de réseau |
| fond | télécharge et décode, parce qu'une image lente sur le fil de rendu gèle le jeu |
| rendu (à nouveau) | envoie vers la carte graphique, seul endroit où un appel OpenGL est légal |

Un `null` veut dire « pas encore », pas « jamais » : l'appelant retombe sur le
rendu vanilla et redemandera à l'image suivante. Une adresse morte se signale une
fois en debug et se retente deux minutes plus tard, **pas à chaque image**.

## 2.10 Le réseau du mod : ne pas redemander ce qui n'a pas bougé

**Fichiers :** `net/PresenceService.java`, `net/ParanoiaApi.java`

Le mod interroge une API tierce pour savoir qui, parmi les joueurs connectés,
utilise Paranoia — une question à laquelle le protocole Minecraft ne répond pas.
Cette interrogation est de la latence potentielle et du travail réseau : elle est
donc rationnée.

| Paramètre | Valeur | Raison |
|---|---|---|
| échantillonnage des joueurs visibles | toutes les 10 ticks (2×/s) | suffit largement |
| premier appel | 5 s après l'arrivée en jeu | pas dès le lancement |
| interrogation sautée | si la liste des joueurs visibles n'a pas changé | l'essentiel de l'économie |
| plancher de rafraîchissement | 120 s | sans lui, un joueur qui lance Paranoia alors qu'on est déjà là n'obtiendrait jamais son badge |
| back-off maximal | 600 s | une API en panne ne doit pas être martelée |

Le drapeau `lookupStale` corrige un défaut de cette économie : quitter un serveur
oublie les cosmétiques, et revenir sur le même serveur avec exactement les mêmes
joueurs donnerait une liste identique — donc l'interrogation serait sautée, et tout
le monde resterait sans cape pendant deux minutes.

**Deux fils, qui ne communiquent que par des champs `volatile` :** le fil du jeu
échantillonne, un fil de fond démon fait le réseau. Aucun appel croisé. Une requête
lente sur le fil de rendu gèlerait le jeu.

Le compteur `ParanoiaApi.requestCount()` est exposé au panneau de diagnostic : un
total qui grimpe lentement **confirme que l'interrogation est bien sautée quand
personne ne bouge**. C'est une optimisation qu'on peut vérifier à l'œil, en jeu.

## 2.11 Les instruments : 1 % low, diagnostic, TPS, ping, portée

Toutes les optimisations du mod sont, sans instruments, **des affirmations**. « Les
textures sont partagées », « les rafales de particules sont écrêtées », « on ne
redemande plus ce qui n'a pas bougé » : rien de tout cela ne se voit à l'écran, et
un réglage qui ne se vérifie pas est un réglage auquel on finit par ne plus croire.

### Le HUD FPS et le 1 % low

**Fichier :** `hud/elements/FpsHud.java`

Le chiffre principal vient de `MinecraftClient.getCurrentFps()` — **le même
compteur que celui de l'écran F3**, pas une mesure maison qui divergerait de ce que
le joueur voit ailleurs.

Le **1 % low** est le centile 99 des durées d'image, rendu en images par seconde.
C'est la mesure qui dit la **régularité**, là où la moyenne dit le débit. Un joueur
à 300 FPS de moyenne et 40 de 1 % low a une expérience pire qu'un joueur à 150
partout : ce sont les à-coups qui font manquer une main, pas le plafond.

Pourquoi le centile et non le minimum : le minimum serait la pire image de la
fenêtre entière, donc n'importe quel à-coup isolé — une valeur qui saute et ne dit
rien. Le centile écarte ces accidents et garde ce qui se répète.

| Paramètre | Valeur | Raison |
|---|---|---|
| échantillons gardés | 1 024 durées d'image | quatre secondes à 250 images/s, une minute à 17 |
| calcul du centile | **une fois par seconde** | trier mille valeurs 240 fois par seconde coûterait plus cher que tout le reste du HUD réuni |
| minimum d'échantillons | 32 | en dessous, le centile ne veut rien dire |
| images ignorées | > 1 s | une image de plus d'une seconde n'est pas une image : c'est un chargement, une pause, ou la fenêtre qui revient. La compter écraserait le centile pour la minute suivante |
| graphe | 26 barres, une par seconde | échelle relative au sommet de la fenêtre, sinon un joueur à 300 images ne verrait qu'une ligne plate |

### Le panneau de diagnostic

**Fichier :** `hud/elements/DiagnosticsHud.java`

Six lignes, chacune répondant à une question qu'on se pose vraiment :

| Ligne | Ce qu'elle prouve |
|---|---|
| Textures | trente joueurs portant la même cape doivent en afficher **une**, pas trente |
| Requêtes | un total qui grimpe lentement confirme que l'interrogation est sautée quand personne ne bouge |
| Particules écartées | combien la rafale a réellement coûté, et si le plafond mord |
| Entités écartées | l'allègement travaille-t-il, ou le réglage est-il trop large pour mordre |
| Blocs animés écartés | **la preuve que l'injection `require = 0` a pris** |
| Mémoire | la seule qui ne concerne pas le mod, et celle qu'on regarde en premier quand le jeu saccade |

Désactivé par défaut : c'est un instrument, pas un ornement.

### L'estimation du TPS serveur

**Fichier :** `net/ServerTpsTracker.java`

Un client vanilla n'a pas accès au TPS : aucun paquet ne le transporte. La seule
mesure disponible est indirecte — le serveur annonce périodiquement l'heure du
monde, et comparer deux annonces donne le nombre de ticks écoulés par seconde
réelle.

C'est donc **une estimation, pas une mesure**, et elle vaut ce que vaut son
hypothèse : un serveur qui fige l'heure du monde rendra un chiffre faux. Dans ce
cas **on préfère ne rien afficher plutôt qu'un nombre inventé** — c'est ce que fait
le `-1`.

| Garde-fou | Valeur |
|---|---|
| intervalle minimal entre deux mesures | 500 ms |
| mesure considérée périmée | 15 s |
| plafond | 20 TPS (au-delà, c'est un rattrapage) |
| lissage | 70 % ancien / 30 % nouveau |

Pourquoi c'est une optimisation : **un joueur qui voit 12 TPS sait que le problème
n'est pas chez lui.** La moitié des plaintes de « lag » en PvP sont des serveurs
qui rament, et cette ligne évite de chercher des images par seconde qui ne
manquent pas.

### Le ping

La valeur vient de la liste des joueurs — celle qu'affiche Tab — **et non d'une
mesure maison** : c'est le même chiffre que celui sur lequel le jeu dessine ses
barres de connexion, donc le joueur ne verra pas deux nombres différents pour la
même chose. En solo, l'élément s'efface plutôt que d'afficher un zéro qui
passerait pour une latence parfaite.

### La portée et le combo

**Fichier :** `combat/CombatTracker.java`

Mesurés **sans injection** : le coup se lit sur le compteur de recharge d'attaque,
qui retombe à zéro au moment où le joueur frappe. C'est une valeur que le mod
lisait déjà, et dont la sonde confirme la signature sur toutes les versions
ciblées. Une injection sur `doAttack` aurait été plus directe, et plus fragile : la
méthode est privée, et son nom comme sa signature bougent d'une version à l'autre.

La distance est prise **entre les yeux du joueur et le point touché**, et non entre
les deux centres : c'est de là que part le rai du jeu, donc c'est la seule mesure
qui corresponde à ce que la portée autorise.

Ses limites sont écrites : ce n'est pas une confirmation de dégâts — le serveur
seul en décide, et il ne la renvoie pas. Un coup lancé sur une cible qui s'écarte
au même moment sera compté.

---
---

# Partie III — Ce qui a été refusé

Cette partie est le cœur du dossier. Dans un client de PvP, la liste de ce qu'on
n'a pas fait dit plus sur la qualité du travail que la liste de ce qu'on a fait.

Chaque refus est donné avec **ce qu'il aurait rapporté** — un refus qui ne coûte
rien n'est pas un arbitrage — et avec la raison qui l'a emporté.

## 3.1 Les trois réglages vidéo interdits

Rappel de la partie 0, ici avec leur gain réel, parce qu'il faut être honnête : ces
trois-là sont **efficaces**. C'est ce qui rend le refus significatif.

| Réglage | Gain réel | Pourquoi refusé |
|---|---|---|
| `particles: minimal` | net sur les explosions, qui sont exactement les moments où le framerate tombe | les particules de coup critique **sont un retour d'information** : elles disent que le crit est passé. Les couper, c'est jouer sans savoir si on a crité |
| `entityDistanceScaling` bas | très net dans une base peuplée ou un lobby | cesse d'afficher les entités lointaines. Cela inclut **le joueur qui arrive** |
| `simulationDistance` bas | réel, côté logique | un adversaire loin se met à jour moins bien. En combat de mobilité, c'est une position fausse |

Ils sont interdits par un test (`JAMAIS` dans `test-graphics-preset.ts`), pas par un
commentaire. Le jour où quelqu'un les remettra « pour gagner des images », la CI
passera au rouge.

## 3.2 Le renvoi de clic droit : une prémisse fausse

**Demande d'origine :** réduire les entrées perdues au clic droit — pearls, boules
de neige, œufs, canne à pêche, arbalète, pose de blocs — quand le ping est élevé.
C'est le principe des mods connus sous le nom de *PVP Optimizer*.

### Premier défaut : structurel

La solution habituelle est de **renvoyer l'action**. Elle a un défaut qui ne se
corrige pas : le client ne peut pas distinguer « ce n'est pas passé » de « c'est
passé mais la réponse n'est pas encore arrivée », puisqu'il n'a que son propre
état, justement en retard.

Renvoyer une action que le serveur a déjà traitée la joue **une seconde fois** :
deux pearls lancées, deux blocs posés. Et cela empire quand le ping monte,
c'est-à-dire précisément quand le mod est censé servir.

### Deuxième défaut : la cause n'était pas le réseau

Le client **verrouille lui-même le clic droit quatre ticks**, et un clic qui tombe
pendant ce verrou n'est pas retardé : **il est jeté**. En combat, on clique plus
vite que ça. L'entrée disparaît sans que le réseau y soit pour rien.

L'idée suivante était donc meilleure : garder le clic jeté et le rejouer au premier
tick autorisé. Un clic donne alors toujours exactement une action, jamais deux, et
le résultat recherché est le même.

### Ce que la sonde a répondu

Avant d'écrire une ligne, la CI a lu le **bytecode** de `MinecraftClient` pour
savoir *où* le verrou de quatre ticks est testé. Deux possibilités changeaient tout
le point d'accroche :

- dans `doItemUse`, qui rendrait la main sans rien faire → on pourrait s'y greffer ;
- dans `handleInputEvents`, qui n'appellerait même pas `doItemUse`.

**Réponse : `doItemUse` n'écrit le verrou que pour le remettre à quatre, elle ne le
lit jamais.** Le test est dans `handleInputEvents`, et il vient **après** que
`useKey.wasPressed()` ait vidé la file d'appuis.

Conséquence : s'accrocher à `doItemUse` n'aurait rien vu, et **la CI serait restée
verte sur un module qui ne corrige rien**. Le clic serait toujours perdu, et le mod
aurait prétendu le contraire.

### La décision

Module abandonné plutôt qu'expédié inerte. L'entrée reste dans la sonde : le jour
où la structure bouge, elle le dira.

C'est le meilleur exemple du dossier de ce que les sondes évitent — non pas un bug,
mais **une fonctionnalité qui aurait été annoncée et n'aurait rien fait**.

## 3.3 Le module de consommation : une régression en production

C'est l'échec le plus sérieux de l'histoire de ce dépôt. Il est documenté ici en
entier, parce qu'un dossier d'optimisation qui ne raconterait que les réussites ne
servirait à rien.

### Ce que le module devait faire

Un *Consumable Optimizer* : traiter la consommation d'un aliment côté client, pour
supprimer le délai que le client s'impose en attendant la confirmation du serveur.
La demande était explicite — plus de délai de consommation, plus de redémarrage
aléatoire, plus de retard sur le son.

### Ce qui a été publié en 0.7.19

Un mixin sur `LivingEntity.tickItemStackUsage` qui terminait la bouchée au tick
prévu, sans attendre le serveur.

### Le mécanisme de la casse

1. Le client termine la bouchée au tick prévu et appelle `clearActiveItem`.
2. Le serveur, lui, n'a pas fini — **c'est tout l'objet du module**.
3. Il renvoie ses données suivies ; `onTrackedDataSet` réécrit `itemUseTimeLeft`.
4. L'animation repart.
5. Boucle : on termine, le serveur relance, on termine.

Une pomme d'or dure **trente-deux ticks** : c'est le cas le plus visible, et c'est
par là que les joueurs l'ont su avant nous. Le signalement en jeu était : « les
pommes d'or buggent, tout le monde n'y arrive plus, ça donne des à-coups. »

### Ce qui a été fait de travers

Ce n'est pas une erreur de lecture de l'API. **La cause avait été identifiée,
écrite dans le commit qui introduisait le module, et la moitié qui déclenche
exactement ce redémarrage a été publiée quand même.**

Les deux moitiés vont ensemble ou pas du tout :

| Moitié | Ce qu'elle fait |
|---|---|
| terminer la bouchée au tick prévu | ce qui a été publié |
| ignorer la réécriture de `itemUseTimeLeft` par `onTrackedDataSet` | ce qui manquait |

Elles ont été séparées en croyant livrer un incrément. Un incrément dont la
première moitié casse le jeu n'est pas un incrément.

### La correction, en 0.7.20

**Retrait complet, et non passage du défaut à faux.** La raison est précise : les
configurations déjà écrites sur les disques des joueurs portent le module activé,
donc changer la valeur par défaut ne l'éteindrait chez personne. Un module absent du
code est ignoré à la lecture de la configuration, le retrait est donc propre.

Ont été retirés : le mixin, le module, son enregistrement, et la capacité de
plateforme qui n'avait plus d'usage. Le reste de la 0.7.19 est intact — crystal,
visée brute, plafond d'images, drapeaux JVM, Sodium, HUD.

### Le soulagement immédiat, sans attendre une version

Le serveur pouvait éteindre le module chez tous les joueurs connectés en envoyant,
sur le canal `paranoia:policy` :

```json
{"blocked": ["consumable"]}
```

C'est le seul mécanisme du projet qui permette de retirer une fonctionnalité en
production sans publier de client. Voir 5.3.

### L'avertissement, écrit là où quelqu'un le lira

Pas dans un fichier de notes : **dans le commentaire de la sonde de
`build-mod.yml`**, à côté de l'entrée `LivingEntity` qui sert à explorer ce chemin
de code. C'est-à-dire exactement à l'endroit où passera quelqu'un qui recommence.

```
# AVERTISSEMENT, paye en production. Le module qui terminait la
# bouchee cote client a ete publie en 0.7.19 et retire en 0.7.20 [...]
# Ne pas remettre la premiere sans la seconde. Une pomme d'or dure
# trente-deux ticks: c'est le cas le plus visible, et c'est par la
# que les joueurs l'ont su avant nous.
```

### Les deux conséquences durables

1. **La règle des deux moitiés.** Une optimisation dont on connaît le mode de
   casse ne se publie pas à moitié, jamais, même pour « avancer ».
2. **La publication en deux temps** (partie V). Cette régression a touché tout le
   monde en même temps parce qu'un push suffisait à prévenir chaque launcher
   installé. Ce n'est plus le cas.

## 3.4 La prédiction de recul

**Proposition examinée :** prédire le knockback côté client pour que le joueur voie
son déplacement immédiatement au lieu d'attendre la correction du serveur.

**Refusé.** La raison est celle de 3.2, appliquée au déplacement : le client ne
connaît pas l'état du serveur. Une prédiction de mouvement qui diverge donne un
rubber-banding — le joueur est ramené en arrière — et un rubber-banding en duel est
pire qu'un retard constant, parce qu'il est **imprévisible** : un joueur s'adapte à
80 ms de latence stable, il ne s'adapte pas à une position qui saute.

La différence avec le crystal (2.8) est précise et vaut d'être répétée : le crystal
meurt de n'importe quel dégât, donc sa disparition est **certaine**. Le recul, lui,
dépend de l'armure, des enchantements de protection contre les explosions, de la
position exacte au moment du calcul serveur, du sprint. C'est une **estimation**, et
une estimation qui bouge la caméra du joueur.

## 3.5 Les réglages Sodium écartés

| Réglage | Gain | Pourquoi refusé |
|---|---|---|
| `chunkBuildDeferMode` | évite des reconstructions coûteuses | retarde l'apparition des blocs posés ou cassés. **En PvP, le retour immédiat d'un bloc posé est tout ce qui compte** |
| `chunkBuilderThreads` | peut aider sur certaines machines | la valeur automatique connaît la machine, **nous non** |
| `useNoErrorGLContext` | quelques pourcents, en supprimant les contrôles du pilote | se paie par un **écran noir** sur les pilotes capricieux |
| `leavesQuality` | net sur les forêts | change ce que le joueur voit : un feuillage plein peut cacher quelqu'un |
| `weatherQuality` | réel sous la pluie | idem |

Deux catégories de refus se distinguent ici, et c'est instructif :

- `chunkBuildDeferMode`, `leavesQuality`, `weatherQuality` : refusés par **la règle
  de la partie 0** — ils retirent de l'information.
- `chunkBuilderThreads`, `useNoErrorGLContext` : refusés par **prudence
  d'ingénierie** — on ne connaît pas la machine, et un écran noir est pire que
  n'importe quel manque d'images.

## 3.6 ZGC : pas une ligne de plus, une branche entière

La tentation est évidente : ZGC annonce des pauses inférieures à la milliseconde,
ce qui est exactement ce que cherche la section 1.5.

**Mesure faite :** `-XX:+UseZGC` posé par-dessus les dix drapeaux G1 donne

```
Error occurred during initialization of VM
```

Changer de ramasse-miettes **remplace** le jeu de drapeaux, il ne s'y ajoute pas :
les drapeaux `G1*` n'ont aucun sens pour ZGC, et la JVM refuse la combinaison.

Le jour où ZGC générationnel sera essayé — il démarre bien sur Java 21 — ce sera
**une branche entière de `tuningFlags`**, pas une ligne de plus dans la liste. Et
l'essai devra être mesuré avec le 1 % low du HUD, pas jugé sur une impression :
ZGC échange du débit contre des pauses courtes, et sur une machine modeste
l'échange peut être défavorable.

Ce fait est verrouillé par un test : `test-jvm-flags.ts` vérifie que
`-XX:+UseZGC` ajouté à la liste fait bien échouer l'initialisation, pour que
personne ne le remette « au cas où ».

## 3.7 Ce que le client ne fera jamais

Une liste courte, pour lever toute ambiguïté sur la nature du projet :

| Refusé par nature | Pourquoi |
|---|---|
| auto-crystal, auto-totem, auto-clicker | ils agissent **à la place** du joueur. Le crystal instantané, lui, n'efface qu'une entité déjà détruite |
| tout ce qui donne une information que le joueur n'a pas | portée de l'adversaire, armure exacte, position hors champ de vision |
| manipulation de paquets pour gagner un avantage | ce n'est plus une optimisation, c'est de la triche |
| désactiver un test du jeu pour gagner des images | un jeu plus rapide et faux n'est pas plus rapide |
| réécrire le rendu du terrain | des années de travail pour arriver, au mieux, là où Sodium est déjà |

Et une distinction que le dépôt tient partout : `ModulePolicy` est **de la
coopération, pas de l'anti-triche**. Le client obéit parce qu'il veut bien ; un
client modifié ignore le paquet. Le protocole sert à ce que les joueurs honnêtes
jouent aux mêmes règles, pas à arrêter quelqu'un de déterminé.

---
---

# Partie IV — Comment on sait que ça marche

Cette partie décrit l'outillage qui fait qu'une optimisation de ce dépôt est
vérifiée plutôt que supposée. C'est ce qui distingue « j'ai posé des drapeaux
recommandés » de « j'ai posé des drapeaux que j'ai donnés à une vraie JVM ».

## 4.1 Les sondes : lire l'API plutôt que la deviner

**Fichier :** `.github/workflows/build-mod.yml`, étape *Probe Minecraft API
signatures*

### Le problème qu'elles résolvent

Le mod cible plusieurs versions de Minecraft dont les noms de classes, de méthodes
et de champs changent. Deviner une signature coûte **un build par essai**, et un
build de quatre versions n'est pas gratuit. Pire : une signature devinée juste par
chance sur une version peut être fausse sur une autre, et le défaut n'apparaît
qu'en jeu.

### Ce que la sonde fait

Pour chaque version construite, elle lance `javap` sur une liste de classes et
filtre les membres intéressants. Elle tourne en `if: always()` — **surtout quand le
build échoue** : c'est précisément le moment où l'on a besoin de savoir à quoi
ressemble réellement l'API.

Une trentaine d'entrées, réparties en deux familles :

- **des témoins de version** : les cibles de mixin en service, gardées en
  permanence, qui signaleront le jour où une version de Minecraft les déplacera ;
- **des questions ouvertes** : ce qu'on cherche à écrire ensuite.

### Ce qu'elle a réellement tranché

| Question | Réponse de la sonde |
|---|---|
| `Style.withFont` prend quoi ? | un `Identifier` en 1.21.8, un `StyleSpriteSource` ensuite — deux types dont l'un n'existe pas dans l'autre version |
| `GameProfile` : `getId()` ou `id()` ? | classe en 1.21.8, record ensuite |
| `ClientWorld.removeEntity` existe-t-elle, avec quelle raison ? | `removeEntity(int, RemovalReason)`, identique sur les deux versions ciblées |
| `addParticle` est-il l'entonnoir unique ? | oui, la variante à coordonnées y passe |
| la configuration Sodium est-elle en snake_case ? | **non, camelCase** — lu dans le jar, contre tous les guides |

Chacune de ces réponses a économisé un aller-retour de build, et deux d'entre elles
auraient produit un mod cassé si elles avaient été devinées.

## 4.2 Les sondes de bytecode

Une signature ne dit pas tout. Deux questions du projet l'ont montré :

- **Rattraper un clic droit jeté** demande de savoir *où* le verrou de quatre ticks
  est testé.
- **Finir de manger à l'instant prévu** demande de savoir *où* le jeu réserve la
  consommation au serveur.

Dans les deux cas, la réponse est **dans le corps de la méthode, pas dans sa
signature**. La sonde lit donc le bytecode (`javap -p -c`), le filtre sur ce qui
intéresse, et — c'est le point — **nomme la méthode qui contient chaque
référence** :

```bash
javap -p -c -cp "$cp" "$corps_classe" \
  | awk -v motif="$corps_motif" '
      /^  [a-z].*\(.*\);$/ { methode = $0 }
      $0 ~ motif {
        if (methode != vu) { print "  dans" methode; vu = methode }
        print "     " $0
      }'
```

### Ce que les sondes de bytecode ont tranché

| Question | Réponse |
|---|---|
| où `itemUseCooldown` est-il testé ? | dans `handleInputEvents`, **après** que `useKey.wasPressed()` ait vidé la file. `doItemUse` ne le lit jamais → module abandonné (3.2) |
| où le countdown de consommation vit-il ? | dans `tickItemStackUsage`, avec le garde `isClient()` et `consumeItem()` — **et non dans `tickActiveItemStack`**, où le premier jet du mixin s'était accroché |
| où le redémarrage d'animation vient-il ? | `onTrackedDataSet` écrit `itemUseTimeLeft` → la cause de la régression 0.7.19, connue **avant** publication |

La deuxième ligne mérite d'être soulignée : **le mixin visait la mauvaise méthode,
et c'est la sonde de bytecode qui l'a corrigé avant publication.** L'outillage a
fonctionné ; c'est la décision de publier une moitié qui a échoué.

## 4.3 Les quatre bancs d'essai

Tous tournent dans le job `checks` de `build-windows`, **à chaque push**, et non
seulement les jours de release.

### Banc 1 — le préréglage graphique

`apps/backend/scripts/test-graphics-preset.ts`

- vérifie que `rawMouseInput:true` et `maxFps:240` sont posés sur **tous** les
  modes, « beauty » compris (c'était le défaut : il n'en recevait aucun) ;
- **échoue si l'une des trois clés interdites apparaît** ;
- vérifie que le témoin empêche un second passage de reprendre au joueur des choix
  qu'il a faits exprès ;
- part d'un `options.txt` réel, y compris en CRLF.

### Banc 2 — les drapeaux JVM

`apps/backend/scripts/test-jvm-flags.ts`

- donne **chaque drapeau un par un** à un vrai `java` ;
- donne ensuite la liste entière avec la mémoire réelle du launcher ;
- verrouille deux faits mesurés : aucun drapeau n'ouvre les options
  expérimentales, et `-XX:+UseZGC` ne s'ajoute pas à ce jeu ;
- retire `JAVA_TOOL_OPTIONS` de l'environnement pour mesurer nos drapeaux seuls ;
- tourne **une fois par majeur** (21 et 25), et échoue si un majeur manque au
  runner plutôt que de le sauter en silence.

C'est le banc qui a attrapé les trois drapeaux expérimentaux (1.6). Sans lui, ils
partaient en production.

### Banc 3 — le préréglage Sodium

`apps/backend/scripts/test-sodium-preset.ts`

Ce module écrit dans un fichier qui contient aussi ce que le joueur a réglé
lui-même. Une écriture maladroite ne se verrait pas en CI et se verrait très bien
en jeu : le banc vérifie surtout que **le reste du fichier survit**.

### Banc 4 — le manifeste de mise à jour

`scripts/test-update-manifest.mjs`, neuf scénarios, dont les deux courses entre
plateformes. Détail en 5.1.

Il tourne à chaque push pour une raison précise : ce script ne s'exécute qu'à la
publication, et son échec ne se voit pas là où on regarde — la release part, les
jobs restent verts, et **seul un joueur qui ne reçoit plus de mise à jour le
découvre**.

## 4.4 Les vérifications de build

Au-delà des bancs, le workflow du mod vérifie quatre choses structurelles :

| Étape | Ce qu'elle attrape |
|---|---|
| *Verify palette matches the launcher* | une couleur du HUD qui dérive de la gamme du launcher |
| *Verify every self-call resolves* | un appel à une méthode qui n'existe pas dans la version ciblée |
| *Verify mixin targets exist* | une cible de mixin disparue — donc un mod à moitié fonctionnel |
| *Build every Minecraft target* | le mod compile contre **chaque** version, pas seulement la dernière |

### Et une étape qui n'existe que pour pouvoir lire les erreurs

*Compile errors, within reach of the log tail*, en `if: failure()`, en toute
dernière position.

Raison d'être, payée d'un aller-retour : les erreurs de compilation étaient
imprimées par Gradle au milieu du journal, puis repoussées hors de portée par les
sondes qui suivent — lesquelles font plusieurs centaines de lignes et tournent en
`always()`. **Un journal de CI ne se lit que par la fin**, et l'erreur qui importait
le plus était justement celle qu'on ne pouvait pas atteindre.

Conséquence concrète : faute de lire l'erreur réelle, sa cause a été devinée, et
devinée faux. L'étape a été ajoutée, et elle a immédiatement livré la vraie erreur
(`cannot find symbol` sur `self.getWorld().isClient()`).

**La leçon vaut pour n'importe quel projet : l'outil de diagnostic se répare avant
le bug.**

## 4.5 Le panneau de diagnostic comme preuve en jeu

La CI vérifie que le code fait ce qu'il dit. Elle ne peut pas vérifier que ça sert
**sur la machine d'un joueur, dans une base pleine de coffres**. C'est le rôle du
panneau (2.11), et il a une fonction particulière pour l'injection `require = 0` :
un compteur qui reste à zéro alors que le module est actif est la seule preuve
disponible que l'injection n'a pas pris.

## 4.6 Ce qui n'est pas mesuré

Un dossier honnête doit contenir cette section.

| Optimisation | État de la mesure |
|---|---|
| `Shapes`, regroupement des bandes | **mesuré exactement** : 1 040 → 218 appels, 93 600 formes comparées pixel par pixel |
| drapeaux JVM | **validité mesurée** sur vraies JVM 21 et 25. Le gain en 1 % low n'est pas mesuré sur une machine de joueur |
| allègement du décor / blocs animés | **comportement vérifié**, gain en images par seconde **non mesuré** dans une base réelle |
| budget de particules | idem : on sait ce qui est écarté (compteur), pas combien d'images ça rend |
| crystal instantané | le gain théorique est un RTT par crystal, ce qui est arithmétique. **Le comportement en jeu n'a pas encore été observé par un joueur sur un vrai serveur** |
| priorité haute du processus | non mesuré |
| mods de performance | gains connus de leurs auteurs, non remesurés ici |
| le HUD lui-même | **jamais vu en jeu** par le commanditaire à la date de ce dossier |

Ce que cela veut dire : la partie « ne rien casser » est solide et outillée ; la
partie « combien ça rapporte » repose sur des calculs et des mesures d'appels, pas
sur des relevés de framerate sur du matériel varié. C'est la première chose à
corriger, et elle figure en annexe G.

---
---

# Partie V — Livrer sans casser

Une optimisation qui casse le jeu chez tout le monde a une valeur négative. Cette
partie décrit les deux mécanismes qui limitent ce risque, et l'interrupteur qui
permet de réparer sans publier.

## 5.1 Le manifeste unique

**Fichier :** `scripts/update-manifest.mjs`

### Le bug, tel qu'il s'est produit

Deux workflows publient la même release : `build-windows` et `build-macos`. Chacun
écrivait un `latest.json` **qui ne contenait que sa propre plateforme**, tous deux
téléversés sous le même nom.

En 0.7.18 : macOS publie à 15:01:55, Windows à 15:03:48. L'entrée `darwin-aarch64`
a disparu du manifeste, et **les deux jobs sont restés verts**.

Conséquence pour un joueur sur la plateforme perdante : plus aucune mise à jour, et
rien ne le signale — le launcher affiche simplement « à jour ».

### La correction

Le manifeste n'est plus téléversé par l'action de release, qui écrase sans rien
lire. Il appartient à un seul script, qui :

1. lit l'état actuel **par l'API** et non par l'URL publique de téléchargement —
   celle-ci passe par un cache, et publier puis relire immédiatement y rend une
   version périmée, c'est-à-dire exactement le cas qui nous intéresse ;
2. ajoute son entrée et **conserve celles des autres** ;
3. relit ce qu'il vient de publier ;
4. **refait tout le cycle** si son entrée — ou une entrée qu'il avait conservée —
   n'y est plus.

Il n'y a pas de verrou à prendre sur une release GitHub : la lecture et l'écriture
ne sont pas atomiques. Plutôt que de faire semblant que cela n'arrive pas, le
script converge — le perdant d'une course la refait, et sa seconde lecture voit le
gagnant.

Neuf scénarios le couvrent, dont « course perdue une fois », « envoi refusé une
fois » et « écrasé sans relâche : échoue au lieu de mentir ».

## 5.2 La publication en deux temps

**Fichier :** `.github/workflows/promote.yml`

### Pourquoi

La 0.7.19 a cassé la consommation des pommes d'or **chez tout le monde en même
temps**, et on l'a appris par des plaintes en jeu. Rien dans la chaîne de
publication ne permettait d'essayer une version avant de l'envoyer à tous : un push
suffisait à prévenir chaque launcher installé.

### Ce qui rend le découpage possible sans toucher au client

L'URL que le launcher interroge — `releases/latest/download/latest.json` — et l'API
`releases/latest` que lit la page de téléchargement **ignorent toutes deux les
préversions**. Une release marquée préversion est donc invisible pour les joueurs
tout en restant installable depuis sa page.

Aucun changement côté launcher, aucune version à distribuer pour que le mécanisme
existe.

### Les deux gestes

| Geste | Effet |
|---|---|
| `git push -u origin release/vX.Y.Z` | build, signature, release **en préversion**, pas de `latest.json` |
| les joueurs | ne voient rien : leur launcher lit la dernière version promue et dit « à jour » |
| les admins | installent depuis la page de la préversion et essaient en jeu |
| `git push -u origin promote/vX.Y.Z` | `latest.json` écrit, **puis** la préversion devient publique |

### Ce que la promotion fait, et ne fait pas

**Elle ne recompile rien.** L'installeur et sa signature sont déjà attachés à la
préversion ; on les lit. Reconstruire donnerait un autre binaire, donc une autre
signature, et le manifeste ne correspondrait plus à ce que les admins ont testé —
ce qui viderait la promotion de son sens.

Quatre garanties :

1. elle **refuse une release déjà publique** — sinon quelqu'un croit avoir franchi
   une étape qui n'a pas eu lieu ;
2. elle compose `latest.json` pour les deux plateformes à partir des **noms
   d'actifs réels** lus sur la release ;
3. elle lève la préversion **après** avoir écrit le manifeste : dans l'autre ordre,
   un client pourrait tomber sur une release visible sans manifeste ;
4. elle **relit l'URL du joueur** et échoue si elle n'annonce pas la bonne version
   **pour toutes les plateformes posées** — c'est exactement le bug de la 0.7.18.

### Ce qui a été répété avant de pousser

Les blocs shell extraits du workflow, joués contre un `gh` factice rendant les noms
d'actifs de la vraie 0.7.20 :

| Cas | Attendu | Obtenu |
|---|---|---|
| les deux plateformes présentes | deux entrées, URL exactes | conforme |
| une seule présente (autre build pas fini) | une entrée, pas d'échec | conforme |
| installeur présent, signature absente | échec | conforme |
| aucun actif de plateforme | échec, « la promotion n'annoncerait rien » | conforme |
| manifeste juste / périmé / **incomplet** / illisible | seul le juste passe | conforme |

## 5.3 L'interrupteur du serveur

**Fichiers :** `net/ModulePolicy.java`, `net/PolicyPayload.java`

**Documentation :** `docs/protocole-politique-modules.md`

| | |
|---|---|
| Canal | `paranoia:policy` |
| Sens | serveur → client |
| Transport | message de plugin standard — utilisable depuis un plugin Paper comme depuis un mod serveur Fabric |
| Charge utile | `{"blocked": ["id", ...]}` |

Ce que ça permet, et qui relève directement de ce dossier : **retirer une
optimisation défectueuse de tous les clients connectés, immédiatement, sans publier
de version.** C'était la sortie de secours disponible pendant la régression 0.7.19.

Trois règles de sûreté :

- **aucun paquet ne veut dire aucune restriction** : un serveur tiers n'a rien à
  dire sur les modules, et le mod doit y rester utilisable ;
- **une charge utile illisible ne verrouille rien** plutôt que de brider le joueur
  sur une erreur de format du serveur ;
- **la politique est oubliée à la déconnexion** : elle ne suit pas sur le serveur
  suivant.

Et la limite, écrite dans le code comme dans la doc : **c'est de la coopération, pas
de l'anti-triche.**

---
---

# Annexes

## Annexe A — Table de tous les réglages d'optimisation

### Côté launcher : posés automatiquement, une seule fois

| Où | Clé | Valeur posée | Modes concernés | Retire de l'information ? |
|---|---|---|---|---|
| `options.txt` | `rawMouseInput` | `true` | tous | non |
| `options.txt` | `maxFps` | `240` | tous | non |
| `options.txt` | `enableVsync` | `false` | performance, balanced | non |
| `options.txt` | `graphicsMode` | rapide | performance | oui (assumé, mode explicite) |
| `options.txt` | `biomeBlendRadius` | `0` | performance | oui (assumé) |
| `options.txt` | `biomeBlendRadius` | `1` | balanced | marginal |
| `options.txt` | `entityShadows` | `false` | performance | oui (assumé) |
| `options.txt` | `renderClouds` | `false` | performance | oui (assumé) |
| `sodium-options.json` | `advanced.cpuRenderAheadLimit` | `1` (défaut 3) | tous | non |
| `sodium-options.json` | `quality.enableVignette` | `false` | tous | non |
| ligne de commande | dix drapeaux JVM | voir annexe B | tous | non |
| processus | priorité | haute | tous | non |

### Côté mod : réglables par le joueur

| Module | Réglage | Défaut | Bornes | Catégorie |
|---|---|---|---|---|
| Budget de particules | activé | **non** | — | Optimisation |
| | particules par tick | 256 | 32 – 2 048 | |
| Alléger le décor lointain | activé | **non** | — | Optimisation |
| | objets au sol au-delà de | 32 blocs | 8 – 128 | |
| | orbes d'expérience au-delà de | 24 blocs | 8 – 128 | |
| | inclure les porte-armures | non | — | |
| | porte-armures au-delà de | 48 blocs | 8 – 128 | |
| | ignorer ce qui est derrière un mur | non | — | |
| | occlusion au-delà de | 12 blocs | 4 – 64 | |
| | inclure joueurs et créatures | **non** | — | |
| | joueurs et créatures au-delà de | 20 blocs | 8 – 64 | |
| Alléger les blocs animés | activé | **non** | — | Optimisation |
| | blocs animés au-delà de | 32 blocs | 8 – 64 | |
| Ralentir hors focus | activé | **non** | — | Optimisation |
| | images par seconde hors focus | 30 | 5 – 120 | |
| Crystal instantané | activé | **oui** | — | Combat |
| Diagnostic Paranoia | activé | non | — | Optimisation |
| | textures et requêtes | oui | — | |
| | particules et entités écartées | oui | — | |
| | mémoire du tas | oui | — | |
| HUD FPS | activé | non | — | HUD |
| | afficher le 1 % low | oui | — | |
| | afficher le graphe | oui | — | |

### Côté mod : constantes non réglables

| Constante | Valeur | Fichier |
|---|---|---|
| durée de validité, décor caché | 250 ms | `EntityVisibility` |
| durée de validité, décor visible | 750 ms | `EntityVisibility` |
| durée de validité, vivant caché | 50 ms | `EntityVisibility` |
| durée de validité, vivant visible | 200 ms | `EntityVisibility` |
| budget de calculs, décor | 24 / tick | `EntityVisibility` |
| budget de calculs, vivants | 32 / tick | `EntityVisibility` |
| cases du cache d'occlusion | 2 048 | `EntityVisibility` |
| rayons par entité | 1 à 9 | `EntityVisibility` |
| portée ordinaire d'un bloc animé | 64 blocs | `BlockEntityCullingModule` |
| rayon maximal d'un coin arrondi | 12 px | `Shapes` |
| échantillons de durée d'image | 1 024 | `FpsHud` |
| barres du graphe FPS | 26 | `FpsHud` |
| plafond d'octets d'un cosmétique | 4 Mo | `CosmeticTextures` |
| plafond de définition d'un cosmétique | 2048×1024 | `CosmeticTextures` |
| durée sans porteur avant libération | 60 s | `CosmeticTextures` |
| échantillonnage des joueurs visibles | 10 ticks | `PresenceService` |
| plancher de rafraîchissement du lookup | 120 s | `PresenceService` |
| back-off maximal | 600 s | `PresenceService` |
| intervalle minimal de mesure du TPS | 500 ms | `ServerTpsTracker` |
| péremption de la mesure du TPS | 15 s | `ServerTpsTracker` |
| délai de retombée du combo | 4 000 ms | `CombatTracker` |

### Côté launcher : réglages du joueur

| Réglage | Défaut | Bornes |
|---|---|---|
| RAM minimale | 2 048 Mo | 512 – 65 536 |
| RAM maximale | 4 096 Mo | 512 – 65 536 |
| arguments JVM supplémentaires | *(vide)* | 1 024 caractères |
| chemin Java | *(vide, runtime téléchargé)* | — |
| résolution | 1 280 × 720 | — |

## Annexe B — Les dix drapeaux JVM, un par ligne

```
-XX:+UseG1GC
-XX:+ParallelRefProcEnabled
-XX:+DisableExplicitGC
-XX:+PerfDisableSharedMem
-XX:MaxGCPauseMillis=50
-XX:G1HeapRegionSize=8M
-XX:G1ReservePercent=20
-XX:G1RSetUpdatingPauseTimePercent=5
-XX:InitiatingHeapOccupancyPercent=15
-XX:+AlwaysPreTouch
```

| Drapeau | Défaut JVM | Groupe | Vérifié sur |
|---|---|---|---|
| `+UseG1GC` | déjà actif | pauses courtes | Java 21, 25 |
| `+ParallelRefProcEnabled` | off | pauses courtes | Java 21, 25 |
| `+DisableExplicitGC` | off | pauses courtes | Java 21, 25 |
| `+PerfDisableSharedMem` | off | pauses courtes | Java 21, 25 |
| `MaxGCPauseMillis` | 200 | pauses courtes | Java 21, 25 |
| `G1HeapRegionSize` | 2M à 4 Go | pauses courtes | Java 21, 25 |
| `G1ReservePercent` | 10 | pauses rares | Java 21, 25 |
| `G1RSetUpdatingPauseTimePercent` | 10 | pauses rares | Java 21, 25 |
| `InitiatingHeapOccupancyPercent` | 45 | pauses rares | Java 21, 25 |
| `+AlwaysPreTouch` | off | pauses rares | Java 21, 25 |

**Interdits, mesurés comme empêchant le démarrage :**

```
-XX:G1NewSizePercent              (expérimental)
-XX:G1MaxNewSizePercent           (expérimental)
-XX:G1MixedGCLiveThresholdPercent (expérimental)
-XX:+UseZGC                       (incompatible avec les drapeaux G1 ci-dessus)
```

## Annexe C — Les six mods de performance

| Mod | Slug Modrinth | Motif de fichier | Rôle | Ce qu'il ne fait pas |
|---|---|---|---|---|
| Sodium | `sodium` | `^sodium[-_]` | rendu du terrain | ne touche pas aux entités ni aux blocs animés |
| Lithium | `lithium` | `^lithium[-_]` | logique de jeu | ne change aucun résultat de calcul |
| FerriteCore | `ferrite-core` | `^ferrite[-_]?core[-_]` | empreinte mémoire | ne gagne pas d'images directement |
| ModernFix | `modernfix` | `^modernfix[-_]` | démarrage et mémoire | — |
| ImmediatelyFast | `immediatelyfast` | `^immediatelyfast[-_]` | dessin du HUD et des interfaces | ne touche pas au terrain |
| Krypton | `krypton` | `^krypton[-_]` | pile réseau | **ne raccourcit pas le trajet jusqu'au serveur** |

Installés à la création du profil uniquement. Témoin :
`.paranoia-performance-mods.json`. Un mod déjà présent est laissé tel quel, quelle
que soit sa version, parce que deux exemplaires empêchent Fabric de démarrer.

## Annexe D — Chronologie des optimisations

| Date | Ce qui a été fait |
|---|---|
| 26 août 2026 | Chargement d'une texture de cosmétique **une seule fois** pour tous ses porteurs |
| 26 août 2026 | Écrêtage des rafales de particules à leur naissance |
| 27 août 2026 | Allègement du décor lointain, avec la règle « jamais un être vivant par distance » |
| 27 août 2026 | Regroupement des optimisations dans leur propre onglet |
| 28 août 2026 | Fin de l'emballage de l'identifiant d'entité à chaque image (`HashMap<Integer>` → trois tableaux) |
| 28 août 2026 | Allègement des blocs animés lointains, avec la protection des balises |
| 30 août 2026 | Relâchement des entités visibles pour tester celles qu'on ignore ; coins hauts d'abord ; question avant calcul |
| 30 août 2026 | Réglage de la JVM (six drapeaux) ; plafond de mémoire vidéo d'un cosmétique 33 Mo → 8 Mo |
| 30 août 2026 | Installation de Sodium, Lithium, FerriteCore, ModernFix à la création du profil |
| 22 sept. 2026 | Visée brute et plafond d'images, sur **tous** les modes |
| 22 sept. 2026 | Sonde de la vraie forme du fichier de configuration Sodium (camelCase, pas snake_case) |
| 22 sept. 2026 | Drapeaux JVM sortis du champ de réglages, dix drapeaux, vérifiés sur vraies JVM 21 et 25 |
| 22 sept. 2026 | Réglage de Sodium : `cpuRenderAheadLimit`, `enableVignette` |
| 22 sept. 2026 | **`Shapes` : 1 040 → 218 appels de dessin par image de HUD (79 %)** |
| 22 sept. 2026 | Ajout d'ImmediatelyFast et Krypton |
| 22 sept. 2026 | Sonde, puis crystal effacé dès la frappe |
| 22 sept. 2026 | Sonde du verrou de clic droit → **module abandonné, prémisse fausse** |
| 22 sept. 2026 | Module de consommation publié (0.7.19) |
| 24 sept. 2026 | **Module de consommation retiré (0.7.20) : régression en production** |
| 25 sept. 2026 | Publication en deux temps : les admins d'abord, les joueurs ensuite |

## Annexe E — Où regarder dans le code

### Launcher et sidecar

| Sujet | Fichier |
|---|---|
| mods de performance | `apps/backend/src/modules/launcher/performanceMods.ts` |
| réglages vidéo | `apps/backend/src/modules/launcher/graphicsPreset.ts` |
| réglages Sodium | `apps/backend/src/modules/launcher/sodiumPreset.ts` |
| drapeaux JVM | `apps/backend/src/modules/launcher/jvmFlags.ts` |
| assemblage du lancement, priorité du processus | `apps/backend/src/modules/launcher/launcher.service.ts` |
| version de Java requise | `apps/backend/src/modules/launcher/javaRequirement.ts` |
| téléchargements vérifiés | `apps/backend/src/modules/launcher/verifiedDownload.ts` |
| réglages et migration | `apps/backend/src/modules/settings/settings.store.ts` |
| attente du service local | `apps/launcher/src/shared/api/http.ts` |
| démarrage du launcher | `apps/launcher/src/app/hooks/useBootstrap.ts` |

### Mod client

| Sujet | Fichier |
|---|---|
| particules | `modules/ParticleBudgetModule.java` + `mixin/ParticleManagerMixin.java` |
| décor lointain | `modules/EntityCullingModule.java` + `mixin/EntityRendererCullingMixin.java` |
| occlusion | `modules/EntityVisibility.java` |
| blocs animés | `modules/BlockEntityCullingModule.java` + `mixin/BlockEntityRendererCullingMixin.java` |
| hors focus | `modules/FocusFpsModule.java` + `mixin/InactivityFpsLimiterMixin.java` |
| crystal | `modules/CrystalCleanupModule.java` + `mixin/ClientPlayerInteractionManagerMixin.java` |
| dessin des formes | `render/Shapes.java` |
| garde-fou par image | `hud/HudElement.java` |
| 1 % low | `hud/elements/FpsHud.java` |
| panneau de diagnostic | `hud/elements/DiagnosticsHud.java` |
| compteur par seconde | `diag/Rate.java` |
| textures partagées | `cosmetics/CosmeticTextures.java` |
| réseau et rythme | `net/PresenceService.java` |
| TPS serveur | `net/ServerTpsTracker.java` |
| portée et combo | `combat/CombatTracker.java` |
| interrupteur serveur | `net/ModulePolicy.java` |

### Vérification et publication

| Sujet | Fichier |
|---|---|
| sondes d'API et de bytecode | `.github/workflows/build-mod.yml` |
| banc du préréglage vidéo | `apps/backend/scripts/test-graphics-preset.ts` |
| banc des drapeaux JVM | `apps/backend/scripts/test-jvm-flags.ts` |
| banc du préréglage Sodium | `apps/backend/scripts/test-sodium-preset.ts` |
| banc du manifeste | `scripts/test-update-manifest.mjs` |
| manifeste de mise à jour | `scripts/update-manifest.mjs` |
| publication en deux temps | `.github/workflows/promote.yml` |
| protocole de politique | `docs/protocole-politique-modules.md` |

## Annexe F — Glossaire

**1 % low** — Le centile 99 des durées d'image, rendu en images par seconde. Dit la
régularité là où la moyenne dit le débit. Un joueur à 300 de moyenne et 40 de 1 %
low a une expérience pire qu'un joueur à 150 partout.

**Bloc animé** (*block entity*) — Coffre, panneau, bannière, shulker, balise : un
bloc qui a son propre rendu, appelé individuellement, en dehors du rendu du
terrain. C'est pourquoi Sodium ne les couvre pas.

**Frustum** — Le volume visible depuis la caméra. Le jeu écarte déjà tout ce qui
est en dehors ; les modules du client ne font qu'ajouter des critères à l'intérieur.

**IHOP** (*Initiating Heap Occupancy Percent*) — Le taux de remplissage du tas à
partir duquel G1 commence son marquage concurrent. Adaptatif par défaut, ce qui
rend la valeur qu'on pose un simple point de départ.

**Mixin** — Mécanisme qui permet à un mod d'injecter du code dans une méthode du
jeu. S'applique **indépendamment des réglages du mod** : un mixin dont la cible a
disparu peut empêcher le jeu de démarrer, y compris chez quelqu'un qui n'a jamais
activé la fonction concernée.

**Mode immédiat** — Façon de dessiner où chaque appel envoie directement sa
géométrie, sans regroupement. C'est ainsi que se dessinent le HUD, le texte et les
interfaces : d'où l'intérêt de réduire le nombre d'appels (`Shapes`) et de les
regrouper (ImmediatelyFast).

**Occlusion** — Le fait qu'un bloc s'interpose entre la caméra et une entité. À
distinguer de la distance : l'occlusion est le seul motif qui puisse, dans ce mod,
faire disparaître un être vivant — et seulement si le joueur l'a explicitement
demandé.

**Région G1** — Unité de découpage du tas par le ramasse-miettes G1. Un objet
dépassant la moitié d'une région est « énorme » et n'est ramassé qu'aux collectes
complètes.

**RTT** (*round-trip time*) — L'aller-retour complet jusqu'au serveur. C'est
l'unité de ce que le crystal instantané économise, par crystal.

**Tick** — Le battement de la logique de jeu : vingt par seconde, soit 50 ms. À
distinguer de l'image, dont la cadence est libre. Plusieurs budgets du mod sont
comptés par tick plutôt que par image, précisément pour que leur coût ne grimpe pas
avec la fluidité.

**TPS** (*ticks per second*) — La cadence réelle du serveur. Vingt est la valeur
nominale ; en dessous, le serveur rame et aucune optimisation client n'y changera
rien.

**Témoin** (fichier) — Un petit fichier JSON qui note qu'un réglage automatique a
déjà été posé, pour ne jamais le reposer. C'est ce qui garantit qu'un choix du
joueur n'est pas écrasé au lancement suivant.

## Annexe G — Ce qui reste à faire

Par ordre d'importance décroissante.

**1. Mesurer en jeu ce qui n'est mesuré qu'en théorie.**
Les modules de culling, le budget de particules et les drapeaux JVM ont un
comportement vérifié et un gain calculé. Il manque des relevés de 1 % low avant et
après, dans une base peuplée, sur au moins deux machines différentes. Le HUD FPS
affiche déjà la bonne mesure pour ça.

**2. Regarder le HUD en jeu.**
Le HUD a été refondu, son coût de dessin divisé par près de cinq, et il n'a **pas
encore été vu en jeu** par le commanditaire à la date de ce dossier. C'est le seul
point de ce dossier qui ne peut pas être vérifié depuis le dépôt.

**3. Essayer ZGC générationnel, correctement.**
Une branche entière de `tuningFlags`, pas une ligne de plus. À juger au 1 % low, pas
à l'impression, et sur une machine modeste autant que sur une machine rapide.

**4. Le délai de consommation, avec ses deux moitiés.**
La demande d'origine reste légitime. Elle demande de traiter `onTrackedDataSet` en
même temps que le countdown, et de l'essayer d'abord en préversion chez les admins
— ce qui est désormais possible.

**5. Vérifier le comportement du limiteur après un alt-tab.**
Le module hors focus s'appuie sur `isWindowFocused()`. Il reste à confirmer en jeu
que le retour au premier plan rétablit immédiatement le plafond, sans attendre le
prochain calcul du limiteur vanilla.

**6. Étendre le crystal instantané à un relevé réel.**
Le gain est arithmétique (un RTT par crystal), le comportement en combat n'a pas
encore été observé. La désynchronisation assumée (2.8) est le point à surveiller :
si elle se produit souvent, la décision de ne pas la corriger devra être revue.

**7. 26.x.**
Les versions 26.1.2 et 26.2 sont déclarées et se construiront d'elles-mêmes dès que
Fabric publiera ses mappings yarn. Rien à faire d'ici là — mais il faudra alors
repasser les sondes, parce que c'est exactement le genre de saut où une signature
bouge.

---

*Fin du dossier. Il décrit l'état du dépôt au 25 septembre 2026. Chaque chiffre
qu'il contient a été relu dans le code au moment de son écriture ; les mesures
citées sont celles des commits qui les ont produites.*

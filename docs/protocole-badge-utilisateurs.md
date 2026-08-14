# Canal `paranoia:users` — badge des utilisateurs

Ce document décrit ce que le serveur doit envoyer pour que les joueurs qui
utilisent le client Paranoia se reconnaissent entre eux.

## Pourquoi le serveur est indispensable

Un client Minecraft ne voit rien de ce que font les autres clients. Le
protocole ne transporte aucune information sur le logiciel utilisé par le
joueur d'en face : ni marque, ni version, ni mods. Il n'existe donc **aucun
moyen côté client** de savoir qui utilise Paranoia.

Seul le serveur peut le savoir, parce que chaque client peut se déclarer à lui,
et lui seul parle à tout le monde. Le mod fournit la moitié cliente ; la moitié
serveur est un plugin qui ne vit pas dans ce dépôt, comme pour
`paranoia:policy`.

## Ce que le serveur envoie

Canal : `paranoia:users`
Sens : serveur → client
Charge utile : une chaîne de caractères contenant du JSON.

```json
{ "users": ["9f7d3a1e-...", "2b41c0d9-..."] }
```

Les identifiants sont les UUID des joueurs connectés qui utilisent le client.
Chaque envoi **remplace** la liste précédente : il n'y a pas d'ajout ni de
retrait incrémental, ce qui évite toute désynchronisation durable.

Quand envoyer :

- à la connexion d'un joueur, pour lui donner l'état courant ;
- à chaque fois que la liste change (connexion, déconnexion), à tous les
  clients Paranoia connectés.

Un client qui ne reçoit rien n'affiche aucun badge. C'est le comportement voulu
sur un serveur tiers : ne rien afficher plutôt qu'affirmer ce qu'on ne sait pas.

## Comment le serveur sait qui utilise le client

Deux méthodes, au choix du plugin :

1. **Les canaux déclarés.** Un client Fabric annonce les canaux qu'il sait
   recevoir. Un joueur qui déclare `paranoia:users` ou `paranoia:policy`
   utilise un client qui embarque le mod.
2. **Une déclaration explicite.** Le plugin envoie `paranoia:policy` à la
   connexion ; seul un client Paranoia y réagit. Le mod n'émet aujourd'hui
   aucun paquet montant, mais peut en émettre un si le plugin en a besoin —
   ouvrez une issue plutôt que de deviner le format.

## Ce que le badge dit, et ce qu'il ne dit pas

Le badge signifie : **le serveur a reçu une déclaration au nom de ce joueur.**
Rien de plus.

Un client modifié peut se déclarer sans utiliser Paranoia, comme il peut
utiliser Paranoia sans se déclarer. C'est un signe de reconnaissance entre
joueurs, pas une preuve, et il ne faut lui accorder aucune valeur d'autorité —
ni pour un avantage en jeu, ni pour une vérification.

## Côté client

- `ParanoiaUsers` tient la liste, remplacée d'un bloc à chaque paquet et vidée
  à la déconnexion.
- `BadgeModule` (catégorie Visuel, activé par défaut) insère un caractère
  coloré devant le nom. Le signe et la couleur sont réglables, et l'affichage
  se coupe séparément pour la liste des joueurs et pour l'étiquette au-dessus
  de la tête.
- Un caractère plutôt qu'une texture : une image demanderait un identifiant de
  ressource et une primitive de dessin dont la signature change d'une version à
  l'autre, alors qu'un caractère s'insère dans le nom existant et suit le rendu
  du jeu partout où ce nom apparaît.

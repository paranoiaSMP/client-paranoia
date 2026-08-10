# Politique de modules — protocole serveur ↔ client

Ce document décrit le canal qui permet à un serveur Paranoia d'interdire
certains modules du client, la luminosité en premier lieu.

## Ce que ça fait, et ce que ça ne fait pas

**C'est de la coopération, pas de l'anti-triche.** Le client obéit parce qu'il
veut bien : il reçoit la liste, grise les modules concernés et refuse de les
activer. Un client modifié ignore le paquet et fait ce qu'il veut. Empêcher
réellement un module demande une détection côté serveur, qui est un autre
chantier.

Le protocole sert donc à ce que **les joueurs honnêtes jouent aux mêmes
règles**, pas à arrêter quelqu'un de déterminé.

## Le canal

| | |
|---|---|
| Identifiant | `paranoia:policy` |
| Sens | serveur → client |
| Transport | message de plugin standard, donc utilisable depuis un plugin Paper aussi bien que depuis un mod serveur Fabric |
| Charge utile | une chaîne UTF-8 contenant du JSON |

Le JSON plutôt qu'un format binaire compact : le protocole peut gagner des
champs sans casser les clients déjà installés, et un plugin Paper l'émet sans
dépendre d'aucun code Fabric.

## Format

```json
{
  "blocked": ["brightness", "colorhit"]
}
```

`blocked` liste les identifiants des modules interdits. Le champ peut être
absent : c'est une politique valide qui n'interdit rien.

Identifiants actuels : `coordinates`, `direction`, `armor`, `info`,
`brightness`, `colorhit`, `crosshair`, `hitindicator`.

## Comportement du client

| Situation | Effet |
|---|---|
| Paquet reçu | les modules listés sont grisés dans le menu et désactivés |
| Aucun paquet | **aucune restriction** — un serveur tiers n'a rien à dire sur les modules |
| JSON illisible | ignoré, aucune restriction, avertissement dans les logs |
| Déconnexion | toutes les restrictions sont levées |

Le choix du joueur est conservé séparément de l'état effectif : un module
interdit sur un serveur redevient actif ailleurs, sans que le joueur ait à le
réactiver à la main.

## Envoi côté serveur

**La moitié serveur n'est pas dans ce dépôt.** C'est un plugin séparé, à écrire
pour le serveur Paranoia. Le principe, en Paper :

```java
// A l'arrivee d'un joueur, apres un court delai pour laisser le client
// terminer sa connexion.
String policy = "{\"blocked\":[\"brightness\"]}";
byte[] payload = encodeString(policy); // VarInt de longueur, puis les octets UTF-8
player.sendPluginMessage(plugin, "paranoia:policy", payload);
```

L'encodage attendu est celui d'une chaîne Minecraft : un VarInt donnant la
longueur en octets, suivi des octets UTF-8. Le canal doit être déclaré au
démarrage du plugin avec `getServer().getMessenger().registerOutgoingPluginChannel(...)`.

Rien n'empêche d'envoyer une nouvelle politique en cours de partie : le client
applique la dernière reçue.

# API Paranoia

Le service heberge du client. Il repond a une seule question que le protocole
Minecraft ne sait pas poser : **qui, parmi les joueurs que je vois, utilise
Paranoia — et que porte-t-il ?**

Sans lui, le badge et les cosmetiques ne peuvent exister qu'a condition que
chaque serveur installe un plugin. Avec lui, ils fonctionnent partout, y
compris sur des serveurs qui n'ont jamais entendu parler de Paranoia.

> A ne pas confondre avec `apps/backend`, qui tourne **sur la machine du
> joueur**, embarque dans le launcher. Celui-ci tourne **sur le VPS** et est
> joignable par n'importe qui : les deux n'ont ni le meme modele de confiance,
> ni le meme cycle de vie, et melanger les deux embarquerait du code de serveur
> dans chaque installation.

## Ce que le service sait, et ce qu'il ignore

| Il connait | Il n'a jamais |
|---|---|
| Les UUID actuellement en jeu avec Paranoia (oublies apres 90 s sans signe de vie) | L'adresse des serveurs ou les joueurs se trouvent |
| Qui possede quels cosmetiques (fichier edite a la main) | Un historique : rien n'est ecrit sur disque |
| | Le contenu des requetes de lookup, jamais journalise |

Le lookup recoit la liste des joueurs qu'un utilisateur a sous les yeux. C'est
la donnee la plus sensible qui transite ici, et elle est traitee en
consequence : `lib/logger.ts` remplace les serialiseurs par defaut pour ne
garder que methode, chemin et code de reponse.

Il n'existe deliberement **aucune route qui liste les utilisateurs**. On ne
peut que verifier des identifiants qu'on possede deja, avec un jeton.

## Authentification

Un service qui croit les clients sur parole laisserait n'importe qui faire
apparaitre le badge a cote du pseudo de quelqu'un d'autre. On reutilise donc
le protocole que tout serveur Minecraft en ligne emploie :

```
mod                        API                       Mojang
 |  POST /v1/auth/begin     |                          |
 | -----------------------> |                          |
 | <----- { serverId } ---- |                          |
 |                          |                          |
 |  join(accessToken, serverId)  ------------------->  |
 |                          |                          |
 |  POST /v1/auth/complete  |                          |
 | -----------------------> |  hasJoined(user, srvId)  |
 |                          | -----------------------> |
 |                          | <---- { id, name } ----- |
 | <----- { token } ------- |                          |
```

Mojang ne repond que si le `serverId` correspond, ce qui prouve que le joueur
detient reellement le compte. Le `serverId` est a usage unique et expire en
60 s.

## Routes

| Route | Jeton | Role |
|---|---|---|
| `GET /health` | non | Sonde de vie |
| `POST /v1/auth/begin` | non | Emet un defi |
| `POST /v1/auth/complete` | non | Verifie chez Mojang, emet le jeton |
| `POST /v1/presence/heartbeat` | oui | « je suis toujours en jeu » |
| `GET /v1/presence/count` | non | Compteur, sans identifiants |
| `POST /v1/users/lookup` | oui | Badges + cosmetiques des joueurs interroges |
| `GET /v1/cosmetics/catalog` | non | Vitrine complete |

L'UUID vient toujours du jeton, jamais du corps : c'est ce qui empeche de
declarer la presence d'autrui.

## Developpement

```
pnpm install
pnpm --filter @paranoia/api dev        # tsx watch
pnpm --filter @paranoia/api test       # Mojang simule, aucun reseau requis
pnpm --filter @paranoia/api typecheck
```

## Cosmetiques

Les donnees vivent dans un fichier JSON, pas une base : le volume tient en
quelques dizaines de lignes et il doit rester editable a la main sur le VPS.

```
cp data/cosmetics.example.json data/cosmetics.json
```

Le service le **relit tout seul a chaque enregistrement**. Une erreur de
syntaxe est journalisee et l'ancien contenu reste servi — une virgule oubliee
ne fait pas disparaitre les cosmetiques de tout le monde. De meme, un objet
porte mais non possede, ou absent du catalogue, est signale et ecarte plutot
que servi au mod qui ne saurait pas le resoudre.

Le vrai fichier est dans `.gitignore` : il contient les UUID des joueurs.

## Deploiement

Voir `docs/tuto-vps-api.md` pour la marche a suivre complete. Les deux
fichiers de `deploy/` sont a copier tels quels :

- `paranoia-api.service` — unite systemd, redemarrage automatique et
  durcissement (le service n'ecrit nulle part, on lui retire l'ecriture) ;
- `Caddyfile` — reverse proxy et certificat Let's Encrypt automatique.

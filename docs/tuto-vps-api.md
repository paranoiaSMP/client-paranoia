# Héberger l'API Paranoia sur le VPS

C'est ce qui fait marcher les badges et les cosmétiques **sur n'importe quel
serveur Minecraft**, y compris ceux qui n'ont jamais entendu parler de
Paranoia.

Le protocole Minecraft ne transporte rien sur le logiciel du joueur d'en face.
Aucun client ne peut deviner qui utilise Paranoia. Il faut donc un tiers que
tous les clients Paranoia partagent : c'est ce service, et c'est la seule
chose que le VPS a besoin de faire.

> **Ce n'est plus le plugin serveur.** L'ancienne approche demandait à chaque
> serveur d'installer `ParanoiaServer` — intenable, aucun serveur public ne
> l'aurait fait. Le plugin reste dans `examples/server-plugin/` : il sert
> encore à **interdire des modules** sur ton propre SMP, ce qu'un service
> central ne peut pas faire à ta place. Mais le badge ne dépend plus de lui.

---

## 1. Avant de commencer : le DNS

Crée un enregistrement **A** chez ton registrar :

```
api.paranoiastudio.fr    A    147.79.21.77
```

Vérifie qu'il est propagé avant la suite — Caddy ne pourra pas obtenir de
certificat tant que le domaine ne pointe pas sur le VPS :

```
dig +short api.paranoiastudio.fr
```

Ça doit répondre `147.79.21.77`. Si c'est vide, attends quelques minutes.

---

## 2. Installer ce qu'il faut

En SSH sur le VPS (voir `tuto-vps-serveur.md` section 1 si besoin) :

```
sudo apt update
sudo apt install -y curl git

# Node 22. Celui d'apt est trop ancien: le service utilise le fetch natif,
# qui n'existe qu'a partir de Node 18, et on veut une version encore
# maintenue.
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

sudo corepack enable
node -v      # doit afficher v22.x
```

---

## 3. Récupérer et compiler

Le service tourne **depuis le clone**, sans copier les fichiers ailleurs. Ce
n'est pas de la paresse : `pnpm` remplit `node_modules` de liens symboliques
vers la racine du dépôt, et déplacer le dossier les casse tous. Le service
échoue alors sur un `Cannot find module 'express'` que rien n'explique.

```
sudo mkdir -p /opt/paranoia-api
sudo chown "$USER" /opt/paranoia-api

git clone https://github.com/paranoiaSMP/client-paranoia.git /opt/paranoia-api
cd /opt/paranoia-api

pnpm install --filter @paranoia/api...
pnpm --filter @paranoia/api build

cd apps/api
cp .env.example .env
cp data/cosmetics.example.json data/cosmetics.json
```

### Si pnpm répond « No projects matched the filters »

Ça veut dire que ton clone ne contient pas `apps/api` : tu es sur une branche
où le service n'existe pas encore. `git clone` prend la branche par défaut, et
tant que le travail n'y est pas fusionné, il faut aller le chercher.

Inutile de recloner — bascule le dossier existant :

```
cd /opt/paranoia-api
git fetch origin claude/client-repository-improvements-613zup
git checkout claude/client-repository-improvements-613zup
ls apps/          # doit maintenant lister: api  backend  client-mod  launcher
```

Puis reprends à partir du `pnpm install` ci-dessus.

Teste tout de suite, avant d'aller plus loin :

```
node dist/main.js
```

Tu dois voir `API Paranoia demarree`. Dans un autre terminal :

```
curl http://127.0.0.1:8080/health
```

→ `{"status":"ok"}`. Coupe avec Ctrl+C.

---

## 4. En faire un service

Le service tourne sous un compte dédié qui n'a **que le droit de lire** les
fichiers — il n'en possède aucun. C'est volontaire : le service n'écrit nulle
part (tout son état est en mémoire), et lui donner la propriété du clone
n'apporterait rien qu'un risque.

```
sudo useradd --system --no-create-home --shell /usr/sbin/nologin paranoia

sudo cp /opt/paranoia-api/apps/api/deploy/paranoia-api.service \
        /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now paranoia-api
sudo systemctl status paranoia-api
```

> Ne fais pas `chown -R paranoia` sur le clone. `pnpm` relie ses paquets au
> magasin de ton compte par des liens physiques : changer le propriétaire du
> clone change aussi celui du magasin, et les installations suivantes en
> pâtissent. Les droits de lecture par défaut suffisent.

`active (running)` en vert : c'est bon. Le service redémarre tout seul en cas
de plantage, et au redémarrage du VPS.

Pour lire les journaux :

```
journalctl -u paranoia-api -f
```

---

## 5. HTTPS

Caddy plutôt que nginx : il obtient et renouvelle le certificat Let's Encrypt
tout seul, sans certbot ni tâche cron.

```
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

sudo cp /opt/paranoia-api/apps/api/deploy/Caddyfile /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

Ouvre le pare-feu si tu en as un :

```
sudo ufw allow 80,443/tcp
```

Le port 80 est nécessaire : c'est par lui que Let's Encrypt vérifie que tu
contrôles le domaine. Le fermer empêche l'obtention du certificat.

Puis, depuis ton PC :

```
curl https://api.paranoiastudio.fr/health
```

→ `{"status":"ok"}` **en HTTPS**. Le service est en ligne.

---

## 6. Vérifier depuis le jeu

Lance le launcher, rejoins n'importe quel serveur, puis ouvre le Tab. Ton
pseudo doit porter le `◆` violet.

Si rien n'apparaît, dans cet ordre :

1. **Le mod est-il chargé ?** `%APPDATA%\.paranoia-client\launcher.log` doit
   contenir `client Paranoia charge`.
2. **Le mod a-t-il pu s'authentifier ?** Dans les logs du jeu, cherche
   `Authentifie aupres de l'API Paranoia`. Si tu vois plutôt
   `API Paranoia injoignable`, le message d'erreur suit sur la même ligne.
3. **Le service voit-il quelqu'un ?**
   ```
   curl https://api.paranoiastudio.fr/v1/presence/count
   ```
   → `{"online":1}` quand tu es en jeu. Si c'est `0`, le mod n'arrive pas à
   joindre l'API : regarde `journalctl -u paranoia-api -f` pendant que tu te
   connectes.

---

## 7. Donner des cosmétiques

Édite `/opt/paranoia-api/apps/api/data/cosmetics.json`. Le service **relit le fichier
tout seul** à chaque enregistrement, aucun redémarrage :

```json
{
  "items": [
    {
      "id": "cape_fondateur",
      "type": "cape",
      "name": "Cape Fondateur",
      "previewUrl": "https://cdn.paranoiastudio.fr/cosmetics/cape_fondateur.png",
      "rarity": "legendary"
    }
  ],
  "players": {
    "ton-uuid-ici": {
      "owned": ["cape_fondateur"],
      "equipped": ["cape_fondateur"]
    }
  }
}
```

Ton UUID se trouve sur https://mcuuid.net à partir de ton pseudo.

Une erreur de syntaxe ne casse rien : le service la signale dans ses journaux
et garde l'ancien contenu. Un objet porté mais absent de `owned` est écarté et
signalé — ça évite de servir au mod une référence qu'il ne saurait pas
résoudre.

---

## 8. Mettre à jour

```
cd /opt/paranoia-api
git pull
pnpm install --filter @paranoia/api...
pnpm --filter @paranoia/api build
sudo systemctl restart paranoia-api
```

Ton `.env` et ton `cosmetics.json` ne sont pas suivis par git : `git pull` ne
les écrase pas.

Les jetons des joueurs sont en mémoire : ils sont perdus au redémarrage, les
mods refont le handshake dans la seconde. Personne ne voit rien.

---

## 9. Ce que ce service sait, et ce qu'il ignore

| Il connaît | Il n'a jamais |
|---|---|
| Les UUID en jeu avec Paranoia, oubliés après 90 s sans signe de vie | L'adresse des serveurs où les joueurs se trouvent |
| Qui possède quels cosmétiques | Le moindre historique — rien n'est écrit sur disque |
| | Le contenu des requêtes, jamais journalisé |

Le lookup reçoit la liste des joueurs qu'un utilisateur a sous les yeux. C'est
la donnée la plus sensible qui transite, et la journalisation est
volontairement réduite à `méthode + chemin + code` pour ne pas reconstituer,
ligne après ligne, qui joue avec qui.

Il n'existe **aucune route qui liste les utilisateurs**. On ne peut que
vérifier des identifiants qu'on connaît déjà, avec un jeton.

## 10. Ce que ça ne fait pas

**Le badge n'est pas une preuve d'identité.** Il signifie : *ce joueur s'est
authentifié auprès de l'API avec son compte Mojang*. C'est solide — le
handshake `join`/`hasJoined` est celui de tout serveur en ligne — mais ça reste
un signe de reconnaissance entre joueurs. Ne lui accorde aucune permission,
aucun avantage en jeu.

**Ce n'est pas de l'anti-triche.** Interdire un module (via le plugin, sur ton
SMP) fonctionne parce que le client veut bien obéir. Un client modifié ignore
la consigne. Empêcher réellement un avantage demande une détection côté
serveur, et ça ne se règle pas par un message au client.

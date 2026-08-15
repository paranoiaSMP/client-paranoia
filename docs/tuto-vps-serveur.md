# Plugin serveur : interdire des modules sur ton SMP

> **Le badge n'a plus besoin de ce plugin.** Il passe désormais par l'API
> Paranoia, que tu héberges une fois pour toutes — voir
> [`tuto-vps-api.md`](tuto-vps-api.md). C'est ce qui le fait marcher sur
> n'importe quel serveur, y compris ceux qui n'installeront jamais rien de
> nous. **Si tu cherches à faire marcher les badges, c'est là qu'il faut
> aller, pas ici.**

Ce plugin garde une seule utilité, mais elle est réelle : **interdire des
modules sur ton propre serveur**. Un service central ne peut pas le faire à ta
place — la question « le fullbright est-il autorisé ? » n'a de réponse que par
serveur, et seul le serveur peut la donner.

| Fonction | Où ça se règle |
|---|---|
| **Badge des utilisateurs** | L'API Paranoia — `tuto-vps-api.md` |
| **Modules interdits** | Ce plugin, sur ton serveur |

Le plugin émet aussi la liste des utilisateurs sur `paranoia:users`. C'est
redondant avec l'API, et conservé simplement parce que ça continue de marcher
si l'API est injoignable : le client fait l'union des deux sources.

Tout le reste — menu, HUD, boutique, mises à jour — ne demande rien au VPS.

---

## 1. Se connecter au VPS en SSH

Il te faut trois choses, toutes dans le panneau de ton hébergeur (OVH,
Contabo, Hetzner, Oracle…) :

- **l'adresse IP** du VPS, par exemple `51.75.12.34` ;
- **le nom d'utilisateur** — souvent `root`, parfois `ubuntu` ou `debian` ;
- **le mot de passe**, ou la clé SSH si tu en as fourni une à la création.

Sous Windows 10 et 11, `ssh` est déjà installé. Ouvre **PowerShell** (touche
Windows, tape `powershell`) et lance :

```
ssh root@51.75.12.34
```

À la toute première connexion, il affiche une empreinte et demande
`Are you sure you want to continue connecting?` — réponds `yes`. C'est
normal, et ça n'arrive qu'une fois par serveur.

Puis il demande le mot de passe. **Rien ne s'affiche pendant que tu le
tapes** — pas d'étoiles, pas de points, le curseur ne bouge pas. Tape à
l'aveugle et appuie sur Entrée.

Tu es dessus quand l'invite change en quelque chose comme
`root@vps-1234:~#`. Tout ce que tu tapes ensuite s'exécute sur le VPS, plus
sur ton PC. `exit` pour revenir chez toi.

### Ne plus retaper le mot de passe

Une fois, sur ton PC :

```
ssh-keygen -t ed25519
```

Entrée à toutes les questions. Puis, en remplaçant l'adresse :

```
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@51.75.12.34 "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys"
```

Il demande le mot de passe une dernière fois. Ensuite `ssh root@51.75.12.34`
entre directement — et `scp`, à l'étape 4, aussi.

### Si ça ne passe pas

| Message | Cause |
|---|---|
| `Connection timed out` | Mauvaise IP, VPS éteint, ou pare-feu qui bloque le port 22. |
| `Permission denied` | Mauvais mot de passe, ou mauvais utilisateur — essaie `ubuntu@` ou `debian@` au lieu de `root@`. |
| `Connection refused` | Le VPS répond mais aucun serveur SSH n'écoute. Démarre-le depuis la console web de l'hébergeur : `systemctl start ssh`. |

Ton hébergeur fournit aussi une **console web** (souvent appelée VNC ou KVM)
qui marche même quand SSH est cassé. C'est le filet de sécurité si tu te
verrouilles dehors.

---

## 2. Ce que le VPS doit avoir

- **Java 21**. Minecraft 1.21.x ne démarre pas en dessous.
  ```
  sudo apt update
  sudo apt install openjdk-21-jdk-headless
  java -version
  ```
- **Un serveur Paper** en 1.21.8, 1.21.10 ou 1.21.11 — les trois versions pour
  lesquelles le mod est compilé. Paper et non Spigot : l'API des canaux de
  plugin est la même, mais Paper est ce que ce plugin a été écrit pour.
- **Le port 25565 ouvert**, ou celui que tu utilises.

Rien d'autre. Le plugin ne fait aucun appel réseau sortant, n'ouvre aucun port,
n'écrit aucune base de données.

---

## 3. Compiler le plugin

Le code est dans ce dépôt, sous `examples/server-plugin/`. Trois fichiers :
la classe du plugin, `plugin.yml`, `config.yml`.

Sur ta machine ou directement sur le VPS :

```
git clone https://github.com/paranoiaSMP/client-paranoia.git
cd client-paranoia/examples/server-plugin
gradle build
```

Le jar sort dans `build/libs/paranoia-server-plugin-1.0.0.jar`.

Si `gradle` n'est pas installé :

```
sudo apt install gradle
```

### Si Gradle refuse le fichier

Une erreur du genre :

```
Could not find method java() for arguments [...] on root project
```

ne vient pas du VPS mais de la **version de Gradle**. Celui d'`apt` est
souvent bien plus ancien que ce que le fichier suppose. Vérifie avec
`gradle -v`.

Le `build.gradle` du dépôt a été réécrit pour tolérer les vieilles versions,
donc commence par tirer la dernière version du dépôt. Si ça coince encore,
n'installe pas Gradle à la main pour autant : **le plugin n'a pas besoin de
Gradle du tout.** Il fait un seul fichier `.java` et sa seule dépendance est
déjà sur le VPS — c'est le jar de ton serveur.

Depuis `examples/server-plugin/`, en remplaçant le chemin par celui de ton
serveur Paper :

```
SERVER_JAR=/chemin/du/serveur/paper.jar

mkdir -p out
javac -cp "$SERVER_JAR" -d out \
  src/main/java/gg/paranoia/server/ParanoiaPlugin.java
cp src/main/resources/plugin.yml src/main/resources/config.yml out/
jar cf paranoia-server-plugin-1.0.0.jar -C out .
```

Le jar produit est identique à celui de Gradle. `javac` et `jar` viennent
avec le JDK 21 installé à l'étape 2 — rien de plus à installer.

Les deux `.yml` sont indispensables et doivent être **à la racine du jar**,
pas dans un sous-dossier : sans `plugin.yml` le serveur ne voit pas le
plugin, et sans `config.yml` la liste des modules interdits reste vide et
aucun fichier de config n'apparaît dans `plugins/`.

---

## 4. Installer

Si tu as compilé **sur le VPS**, le jar y est déjà : copie-le simplement au
bon endroit.

```
cp build/libs/paranoia-server-plugin-1.0.0.jar /chemin/du/serveur/plugins/
```

Si tu as compilé **sur ton PC**, envoie-le avec `scp`, depuis PowerShell, en
remplaçant l'adresse par la tienne :

```
scp build/libs/paranoia-server-plugin-1.0.0.jar root@51.75.12.34:/chemin/du/serveur/plugins/
```

`scp` utilise la même connexion que `ssh` : si l'étape 1 marche, celle-ci
marche aussi.

Puis, sur le VPS :

```
# redémarrage complet, pas /reload : un reload à chaud laisse
# les canaux de plugin dans un état incohérent
systemctl restart minecraft      # ou ta commande habituelle
```

Dans la console, tu dois voir :

```
[ParanoiaServer] Paranoia: canaux paranoia:policy et paranoia:users ouverts
```

---

## 5. Régler les modules interdits

Le fichier apparaît au premier démarrage, dans
`plugins/ParanoiaServer/config.yml` :

```yaml
blocked:
  - brightness
```

Les identifiants disponibles : `brightness`, `colorhit`, `crosshair`,
`hitindicator`, `badge`, `coordinates`, `direction`, `armor`, `info`, `fps`,
`cps`, `effects`.

Un module interdit s'affiche **VERROUILLÉ** dans le menu du joueur — gris,
inerte, avec l'explication. Liste vide = rien d'interdit.

Après modification, redémarre le serveur.

---

## 6. Vérifier que ça marche

Connecte-toi avec le launcher Paranoia, puis :

1. **Ouvre le Tab.** Ton pseudo doit porter un `◆` violet devant. Si un autre
   joueur avec le client est connecté, il en porte un aussi.
2. **Maj droite → onglet Modules.** Le module listé dans `blocked` doit
   afficher `VERROUILLÉ` en gris au lieu de `ACTIVÉ`/`DÉSACTIVÉ`.

Si rien n'apparaît, dans cet ordre :

- Le joueur utilise-t-il bien le launcher Paranoia, et le mod est-il chargé ?
  Vérifie `%APPDATA%\.paranoia-client\launcher.log` côté client : la ligne doit
  dire `client Paranoia charge`.
- Le plugin est-il démarré ? Cherche la ligne `canaux ... ouverts` au
  démarrage.
- Le module **Badge Paranoia** est-il activé dans le menu du joueur ? Il l'est
  par défaut, mais il se désactive.

---

## 7. Ce que ça ne fait pas

À lire avant de compter dessus.

**Ce n'est pas de l'anti-triche.** Le client obéit à la politique parce qu'il
veut bien. Un client modifié ignore le paquet et garde ses modules. Empêcher
réellement un avantage demande une détection côté serveur — c'est un autre
chantier, et il ne se règle pas par un message au client.

**Le badge n'est pas une preuve.** Il signifie : *ce joueur a déclaré les
canaux Paranoia*. Un client modifié peut les déclarer sans utiliser Paranoia,
comme un joueur peut utiliser Paranoia sans être détecté si sa connexion s'est
faite dans un ordre inhabituel. C'est un signe de reconnaissance entre joueurs.
**Ne lui accorde aucun avantage en jeu, aucune permission, aucune vérification
d'identité.**

---

## 8. Détail technique, si tu modifies le plugin

La charge utile n'est pas du JSON brut. Le client la lit avec
`PacketCodecs.STRING`, qui attend **une longueur en VarInt suivie de l'UTF-8**.
Envoyer les octets du JSON directement donne un paquet que le client rejette en
silence — pas d'erreur, pas de log, rien.

C'est le piège le plus facile ici, et la méthode `encode()` du plugin existe
uniquement pour ça. Si tu réécris le plugin dans un autre langage, commence par
là.

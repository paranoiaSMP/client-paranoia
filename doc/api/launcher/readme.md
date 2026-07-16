# Lancement du Jeu (Launcher Service)

Ce document explique le processus de lancement d'une instance Minecraft, orchestre par le service backend (`launcher.service.ts`). Ce service se charge de la verification des pre-requis, du telechargement des ressources (assets), de la configuration des arguments de la Java Virtual Machine (JVM) et du demarrage du jeu via la bibliotheque `minecraft-launcher-core`.

Le processus de lancement se divise en quatre grandes etapes :

### 1. Verification de l'environnement Java
Avant de lancer le jeu, le systeme s'assure qu'un environnement d'execution Java (JRE) adequat est present.
La fonction `ensureJava21` est appelee pour verifier l'existence de l'executable Java dans le repertoire cible. Si celui-ci est manquant, le service initie le telechargement d'une archive contenant Eclipse Temurin JRE 21 depuis l'API Adoptium. 
Le fichier zip est ensuite extrait automatiquement dans le dossier racine du client (`.paranoia-client`), fournissant ainsi un **javaPath** valide.

### 2. Configuration des Launch Options
Le service prepare l'objet d'options (`opts`) requis par `minecraft-launcher-core`. Cet objet regroupe toutes les donnees d'authentification et les parametres d'execution :
- **Authorization** : Injecte les informations recuperees lors du processus Microsoft OAuth2 (**Access Token**, **UUID**, **Username**). Le `client_token` est defini sur "paranoia-client".
- **Version** : Specifie le numero de la version de Minecraft a lancer (ex: "1.21.1").
- **Memory** : Definit la RAM maximale (Xmx) et minimale (Xms) allouee a la JVM (configuree selon le parametre `ramMb`).
- **Overrides** : On force la propriete `maxSockets` a 6. Cela evite de saturer le systeme de requetes asynchrones lors du telechargement massif des bibliotheques du jeu (prevention des erreurs `EMFILE`).
- **Root** : Definit le dossier racine d'installation du jeu (AppData/Roaming/.paranoia-client).

### 3. Ecoute des evenements (Event Listeners)
Une fois le client instancie, le service s'abonne a divers evenements de telechargement et d'execution pour informer l'interface utilisateur en temps reel :
- **progress** : Capte la progression du telechargement des bibliotheques (libraries) et des ressources (assets). La progression est calculee sous forme de pourcentage et envoyee a l'etat global (State).
- **debug** / **data** : Enregistre les journaux de debuggage et la sortie standard de la JVM.
- **close** : Detecte l'arret du processus du jeu et reinitialise le statut a "idle".

### 4. Execution (Launch)
Une fois les options preparees et les evenements branches, la methode asynchrone `launcher.launch(opts)` est executee. 
Cette methode va d'abord resoudre et telecharger les fichiers manquants (Minecraft client jar, libraries, assets JSON). Une fois les telechargements termines, elle construit dynamiquement la ligne de commande (classpath, arguments JVM, arguments du jeu) et cree un processus enfant pour lancer Minecraft.

---

**Resume de l'Execution Flow :**
`Verification Java 21` -> `Configuration des Launch Options` -> `Abonnement aux Evenements` -> `Telechargement des Assets` -> `Demarrage du processus JVM`.

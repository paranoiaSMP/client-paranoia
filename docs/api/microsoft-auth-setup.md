# Microsoft Authentication pour Minecraft
Ce document explique l'Authentication Flow OAuth2 permettant d'obtenir le profil d'un joueur Minecraft via un compte Microsoft. Cette procedure est indispensable pour verifier qu'un utilisateur possede bien une licence Minecraft Java Edition valide et pour securiser l'acces aux serveurs du jeu.
Le processus se divise en cinq etapes consecutives (visible dans `auth.microsoft.ts`) :
### 1. Obtention du Microsoft Token
Le processus debute lorsqu'un utilisateur s'authentifie via le portail Microsoft OAuth2.  
Apres une connexion reussie, Microsoft redirige l'utilisateur vers l'application avec un **Authorization Code**. Ce code est ensuite echange via l'API Microsoft contre un **Access Token** et un **Refresh Token** (qui permettra de renouveler la session sans exiger une nouvelle saisie des identifiants).
### 2. Authentification Xbox Live (XBL)
L'Access Token obtenu a l'etape precedente doit etre presenté a l'API Xbox Live (`user.auth.xboxlive.com`). 
En retour de cette requete, le systeme delivre un **XBL Token** (Xbox Live Token) ainsi qu'un **UserHash** (uhs), qui sert d'identifiant unique au sein de l'ecosysteme Xbox.
### 3. Authentification XSTS (Xbox Security Token Service)
Le **XBL Token** doit ensuite etre echange contre un **XSTS Token**. Ce token est la preuve d'autorisation finale chez Xbox. 
Pour un compte Microsoft classique essayant d'acceder a un jeu sur PC, on precise lors de la requete que l'environnement cible (**SandboxId**) est "RETAIL" et on fournit en tant que **Relying Party** l'URL `rp://api.minecraftservices.com/`.
### 4. Authentification Minecraft
Une fois le **XSTS Token** et le **UserHash** en notre possession, nous pouvons les soumettre a l'API d'authentification de Minecraft (`api.minecraftservices.com/authentication/login_with_xbox`).
Si la requete est acceptee, Mojang renvoie le **Minecraft Access Token**. Ce token garantit l'acces legitime aux services en ligne de Minecraft.
### 5. Recuperation du Minecraft Profile
La derniere etape consiste a interroger l'API des profils de Minecraft avec le **Minecraft Access Token**.
L'API renverra le payload contenant les informations du joueur :
- **Username** (le pseudo en jeu)
- **UUID** (l'identifiant unique)
- **Skin URL** (le lien vers la texture du personnage)
*Note technique :* Si l'API renvoie un code HTTP 404 a cette etape, cela signifie que le compte Microsoft authentifie ne possede pas de licence valide pour Minecraft Java Edition. Dans ce cas, l'acces doit etre refuse.
---
**Resume de l'Authentication Flow :**
`OAuth Code` -> `Microsoft Token` -> `Xbox Live Token` -> `XSTS Token` -> `Minecraft Access Token` -> `Minecraft Profile`.

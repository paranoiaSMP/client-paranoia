# Stratégie Anti-Cheat : Prévention d'Injection et de Mods

Ce document résume les différentes approches envisageables pour sécuriser notre client de jeu contre l'injection de tricheurs (DLLs, Java Agents) et l'ajout de mods illicites, classées de la plus simple à implémenter à la plus complexe.

---

## Niveau 0 : Gestion stricte des Fichiers et des Mods (La Base)

- **Type de méthode :** Nettoyage de dossier & Whitelisting (Vérification de Hash)
- **Ce qu'il fait :** Avant même de lancer le jeu, le launcher scanne le dossier des mods. Il supprime tout fichier inconnu et compare le hash (SHA-256) de chaque mod avec une liste blanche (Whitelist) hébergée sur notre serveur. Tout mod non autorisé (ou modifié) est supprimé et le lancement est bloqué.
- **Point Fort :** C'est la base absolue. Cela élimine 100% des tricheurs basiques qui se contentent de glisser un mod de triche (X-Ray, clients modifiés) dans leur dossier. Très facile et rapide à coder dans le launcher.
- **Point Faible :** Un tricheur intelligent peut modifier le code du launcher lui-même pour désactiver cette vérification (bypass), d'où l'importance de combiner cela avec les niveaux de sécurité suivants.

---

## Niveau 1 : Sécurité au niveau de la JVM

- **Type de méthode :** Argument de lancement (JVM)
- **Ce qu'il fait :** Le jeu est lancé avec l'argument `-XX:+DisableAttachMechanism` qui verrouille le processus Java de l'extérieur.
- **Point Fort :** Extrêmement efficace contre les tricheurs qui utilisent des "Java Agents" pour s'infiltrer dans le jeu une fois qu'il a passé la vérification du Niveau 0.
- **Point Faible :** Inutile contre les injections de code natif (DLL en C/C++) ou les modifications directes de la mémoire (Manual Mapping).

---

## Niveau 2 : Politiques d'atténuation Windows

- **Type de méthode :** Process Mitigation (API OS native)
- **Ce qu'il fait :** Lors de la création du processus de jeu via notre launcher Rust, on indique à Windows de bloquer automatiquement toute DLL qui ne possède pas une signature numérique officielle de Microsoft.
- **Point Fort :** Bloque la grande majorité des tricheurs amateurs et des injecteurs de DLL génériques sans avoir à développer d'anti-cheat complexe. Excellent ratio temps investi / sécurité.
- **Point Faible :** Un tricheur avec de bonnes connaissances peut signer sa DLL frauduleuse (avec un certificat volé) ou utiliser des techniques pour contourner le chargement classique de DLL.

---

## Niveau 3 : Anti-Cheat User-Mode personnalisé

- **Type de méthode :** Injection de DLL & API Hooking
- **Ce qu'il fait :** Le launcher injecte notre propre "DLL de Sécurité" dans le jeu dès la première seconde. Cette DLL va détourner (hooker) les fonctions Windows du jeu. Si le jeu essaie de charger un module, notre DLL l'analyse et le bloque s'il est suspect. Un scanner de mémoire tourne également en tâche de fond.
- **Point Fort :** Offre un contrôle total sur la sécurité. Permet de cibler spécifiquement les techniques de triche utilisées contre notre jeu et de bannir des joueurs automatiquement.
- **Point Faible :** Développement long et complexe. De plus, un cheat développé avec soin peut détecter notre DLL et la désactiver ("Unhooking").

---

## Niveau 4 : Anti-Cheat Kernel-Mode (Type Vanguard / BattlEye)

- **Type de méthode :** Driver Système (Ring 0 / Espace Noyau)
- **Ce qu'il fait :** Un programme tourne au niveau le plus profond de Windows (en dessous du jeu, de l'antivirus et des cheats). Il surveille les moindres recoins de la mémoire de l'ordinateur et empêche physiquement toute altération du processus du jeu.
- **Point Fort :** La protection ultime. C'est la norme dans les jeux compétitifs AAA modernes.
- **Point Faible :** Extrêmement coûteux et difficile à coder. Nécessite l'achat d'un certificat *EV Code Signing*. Le moindre bug dans le code provoquera un plantage complet de l'ordinateur du joueur (BSOD - Écran Bleu de la mort). Déconseillé pour une équipe indépendante.

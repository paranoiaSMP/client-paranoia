Description
Cette Pull Request introduit l'intégration du système multilingue, la détection de profils locaux, ainsi que plusieurs optimisations visuelles et de configuration.

Fonctionnalités ajoutées & Modifications
Support Internationalisation (i18n) :

Ajout et configuration de i18next et react-i18next.
Création des dictionnaires fr.json et en.json.
Intégration d'un sélecteur de langue dynamique dans l'onglet "Sous le capot" modifiant la langue à la volée.
Intégration Backend (Tauri / Rust) :

Ajout de la commande Tauri get_detected_profiles pour scanner dynamiquement %APPDATA% et %USERPROFILE% à la recherche des profils Minecraft existants (Lunar, Modrinth, etc.).
UI & UX (Design Guidelines) :

Nettoyage de l'interface en supprimant la dépendance au statut de serveur comme demandé.
Respect strict des consignes UI/UX : Règle de design F/Z, règle des 3 clics, contrastes optimisés et utilisation de la palette de couleurs 60-30-10.
Ajout d'animations fluides, de bordures interactives et de drop-shadows pour une expérience premium.
Système de News configurable :

Modification de news.routes.ts pour une meilleure flexibilité.
Ajout du support de variables d'environnement (.env via VITE_NEWS_URL) pour overrider la source des news et les récupérer depuis le web sans recompiler.
Amélioration du dépôt :

Mise à jour et sécurisation du fichier .gitignore pour éviter le versioning accidentel de fichiers sensibles (.env.*.local, logs pnpm, .idea, etc.).
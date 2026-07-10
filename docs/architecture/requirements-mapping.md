# Mapping Cahier des Charges -> Implementation

## First Setup

- [x] Etape 1 Connexion (UI obligatoire avant suite)
- [x] Etape 2 Choix version Minecraft
- [x] Etape 3 Choix type de profil depuis config distante
- [x] Etape 4 Choix mode graphique depuis config distante
- [x] Etape 5 Installation: creation manifest + creation profil
- [x] OAuth Microsoft reel (token exchange + account linking)

## Gestion des profils

- [x] Creer
- [x] Supprimer
- [x] Dupliquer
- [x] Favori
- [x] Import/Export API
- [ ] Renommer dedie (actuellement via PATCH)
- [ ] Import/Export fichier local dans UI launcher

## Launcher

- [x] Tauri + React + TS base
- [x] Theme premium sombre glassmorphism
- [x] Verification SHA-256 (commande native Rust)
- [x] Recuperation config distante
- [x] Manifest dynamique sans hardcode mods
- [ ] Auth Microsoft officielle complete
- [ ] Multi-comptes launcher
- [ ] Telechargements paralleles + resume complet
- [ ] Installation auto Java/Fabric complete
- [ ] Branches stable/beta dynamiques
- [ ] Discord Rich Presence

## Backend

- [x] API REST modulaire
- [x] Endpoints catalog/profiles/news/server-status/cosmetics/updates/telemetry
- [x] Validation Zod + erreurs JSON
- [x] Prisma schema PostgreSQL initial
- [ ] Persistance DB effective (remplacer store JSON)
- [ ] Signature cryptographique des manifests

## Client Fabric

- [x] Base Java 21 + Fabric
- [x] HudManager modulaire et modules de base
- [x] Point d entree menu Right Shift pre-cable
- [ ] HUD editor drag-and-drop complet
- [ ] Interface complete custom sans ecrans vanilla
- [ ] Cosmetiques synchronises runtime

## Securite

- [x] Baseline rules centralisees
- [x] Integrite pre-lancement (SHA-256)
- [x] Endpoint security telemetry avec consent
- [ ] Monitoring runtime avance et anti-injection complet
- [ ] Update auto des regles de detection

## Remarque cle

Toutes les combinaisons version/type/mode et la liste des artifacts sont pilotees par configuration distante et non par hardcode launcher. Changer un pack ne necessite pas de release launcher.

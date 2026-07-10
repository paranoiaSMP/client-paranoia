# Architecture Globale

## Monorepo

- Launcher desktop: `apps/launcher` (Tauri + React)
- Backend API: `apps/backend` (REST + PostgreSQL)
- Client Fabric: `apps/client-mod` (Java 21)
- Contrats partages: `packages/contracts`
- Schéma de configuration distante: `packages/config-schema`
- Regles de securite: `packages/security-rules`

## Principes

- SOLID et separation stricte des responsabilites
- Modulaire: chaque fonctionnalite est encapsulee
- Config distante signee: aucun mod hardcode dans le launcher
- Observabilite: logs, crash reports, telemetry conditionnelle

## Flux First Setup

1. Auth Microsoft obligatoire
2. Choix version Minecraft
3. Choix type de profil (template distant)
4. Choix mode graphique (template distant)
5. Recap + installation automatique

## Installation dynamique

Le launcher appelle `/v1/catalog/remote-config` puis `/v1/catalog/manifest`.

Le manifest retourne tous les artifacts (mods, shaders, packs, configs, fichiers custom) avec:

- URL CDN
- SHA-256
- targetPath
- metadata

Le moteur d installation:

- telecharge en parallele
- reprend les transferts interrompus
- verifie SHA-256 avant activation
- rollback propre en cas d erreur

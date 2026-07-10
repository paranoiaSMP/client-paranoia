# Paranoia Client Monorepo

Base de projet professionnelle pour construire **Paranoia Client**:

- Launcher: Tauri + Rust + React + TypeScript
- Client Minecraft: Fabric + Java 21
- Backend: API REST + PostgreSQL
- Configuration distante: profils/types/modes sans liste de mods codée en dur

## Structure

- `apps/launcher`: application desktop (Tauri)
- `apps/backend`: API REST (Node.js + TypeScript)
- `apps/client-mod`: mod Fabric (Java 21)
- `packages/contracts`: types partages (launcher/backend)
- `packages/config-schema`: schema JSON de config distante
- `packages/security-rules`: regles anti-tamper et signatures
- `docs`: architecture, API, securite
- `examples/remote-config`: exemples de catalogue distant

## Principes

- SOLID et architecture modulaire
- Aucun mod pack hardcode dans le launcher
- Tout pack installe depuis une configuration distante signee
- Verification SHA-256 et reprise de telechargements
- Mises a jour automatiques et observabilite

## Demarrage rapide

1. Installer Node 22+, pnpm, Rust, Java 21.
2. Copier `.env.example` en `.env` et renseigner les secrets.
3. Installer les dependances:

```bash
pnpm install
```

4. Lancer l API:

```bash
pnpm --filter @paranoia/backend dev
```

5. Lancer le launcher web (React):

```bash
pnpm --filter @paranoia/launcher dev
```

6. Lancer Tauri:

```bash
pnpm --filter @paranoia/launcher tauri dev
```

## Etat actuel

Ce repository contient un **socle complet**: architecture, contrats, schemas, squelettes de modules et documentation.
Les fonctionnalites metier (auth Microsoft, orchestration d installation, anti-cheat runtime avance) sont pre-cablees et prêtes a etre implementees module par module.

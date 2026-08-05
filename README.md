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

1. Installer Node 22+, pnpm et Rust. (Java 21 est telecharge automatiquement par
   le launcher, il n est pas necessaire de l installer.)
2. Optionnel: copier `.env.example` en `.env`. Le backend demarre sans.
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

## Catalogue distant

`examples/remote-config/install-catalog.json` couvre chaque combinaison
version / type de profil / mode graphique annoncee par `stable-config.json`,
avec une liste d artefacts **vide**: aucun mod n est installe pour l instant.

Pour ajouter un mod, completer le tableau `artifacts` d une entree:

```json
{
  "id": "sodium",
  "kind": "mod",
  "fileName": "sodium-fabric-0.6.0.jar",
  "downloadUrl": "https://cdn.exemple.gg/mods/sodium-fabric-0.6.0.jar",
  "sha256": "<empreinte sha256 reelle du fichier>",
  "size": 1234567,
  "targetPath": "mods/sodium-fabric-0.6.0.jar",
  "optional": false
}
```

Deux regles appliquees au telechargement:

- le `sha256` doit correspondre au fichier recu, sinon l installation echoue
  (`sha256sum <fichier>` pour l obtenir);
- `targetPath` est toujours resolu **dans** le dossier d installation, un
  chemin remontant vers le parent est refuse.

Les entrees dont `fabricLoaderVersion` est absent lancent Minecraft en vanilla.
Renseigner ce champ pour que le mod Fabric du client soit charge.

## Etat actuel

Ce repository contient un **socle complet**: architecture, contrats, schemas, squelettes de modules et documentation.
Les fonctionnalites metier (orchestration d installation complete, anti-cheat runtime avance) sont pre-cablees et prêtes a etre implementees module par module.

Points connus restant a traiter:

- les jetons de compte vivent en memoire du launcher: le `refreshToken` n est
  pas encore utilise, il faut se reconnecter apres expiration;
- `/v1/launcher/play` et les routes de profils ne sont pas authentifiees; elles
  ne sont protegees que par la restriction CORS et l ecoute en local;
- la signature des manifestes (`signature`) n est pas encore verifiee;
- l historique git contient encore ~137 Mo de JARs Gradle supprimes du suivi:
  seul un reecriture d historique (git filter-repo / BFG) peut les enlever.

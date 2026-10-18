# Graph Report - ParanoiaLauncher  (2026-10-12)

## Corpus Check
- Large corpus: 402 files · ~627,462 words. Semantic extraction will be expensive (many Claude tokens). Consider running on a subfolder.

## Summary
- 2682 nodes · 6312 edges · 147 communities (96 shown, 51 thin omitted)
- Extraction: 94% EXTRACTED · 6% INFERRED · 0% AMBIGUOUS · INFERRED: 391 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- HUD editor (mod)
- Accounts store
- Background style (mod)
- HUD elements (mod)
- Launcher App shell
- Inventory rendering (mod)
- Backend logger and paths
- Cape template generator
- Discord RPC and Fabric download
- Auth restore test
- Keybinds import UI
- Dependency overrides
- Community 12
- Community 13
- Community 14
- Community 15
- Community 16
- Community 17
- Community 18
- Community 19
- Community 20
- Community 21
- Community 22
- Community 23
- Community 24
- Community 25
- Community 26
- Community 27
- Community 28
- Community 29
- Community 30
- Community 31
- Community 32
- Community 33
- Community 34
- Community 35
- Community 36
- Community 37
- Community 38
- Community 39
- Community 40
- Community 41
- Community 42
- Community 43
- Community 44
- Community 45
- Community 46
- Community 47
- Community 48
- Community 49
- Community 50
- Community 51
- Community 52
- Community 53
- Community 54
- Community 55
- Community 56
- Community 57
- Community 58
- Community 59
- Community 60
- Community 61
- Community 62
- Community 63
- Community 64
- Community 65
- Community 67
- Community 68
- Community 69
- Community 71
- Community 73
- Community 74
- Community 75
- Community 76
- Community 77
- Community 78
- Community 79
- Community 80
- Community 81
- Community 82
- Community 83
- Community 84
- Community 85
- Community 86
- Community 87
- Community 88
- Community 89
- Community 90
- Community 91
- Community 92
- Community 93
- Community 94
- Community 95
- Community 96
- Community 97
- Community 98
- Community 99
- Community 100
- Community 101
- Community 102
- Community 103
- Community 104
- Community 105
- Community 106
- Community 107
- Community 108
- Community 109
- Community 110
- Community 111
- Community 112
- Community 113
- Community 114
- Community 115
- Community 116
- Community 117
- Community 118
- Community 119
- Community 121
- Community 122
- Community 124
- Community 125
- Community 126
- Community 127
- Community 130
- Community 132
- Community 146

## God Nodes (most connected - your core abstractions)
1. `HudElement` - 71 edges
2. `ModuleWindow` - 64 edges
3. `Module` - 60 edges
4. `apiRequest()` - 56 edges
5. `BooleanSetting` - 46 edges
6. `ColorSetting` - 42 edges
7. `TitleController` - 42 edges
8. `ModuleCategory` - 38 edges
9. `App()` - 36 edges
10. `launchMinecraft()` - 29 edges

## Surprising Connections (you probably didn't know these)
- `Part 0: PvP-first admission rule` --semantically_similar_to--> `PvP-first optimization rule`  [EXTRACTED] [semantically similar]
  docs/dossier-optimisation.md → README.md
- `Level 0: file cleanup and SHA-256 whitelist` --semantically_similar_to--> `Integrity control (SHA-256, signed manifest, rescan)`  [INFERRED] [semantically similar]
  doc/anti-cheat-strategy.md → docs/security/security-model.md
- `Installation manifest (artifacts, URL, SHA-256, targetPath)` --implements--> `Signed remote config, no hardcoded mods`  [INFERRED]
  docs/architecture/overview.md → README.md
- `Ten JVM flags (short-pause vs rare-pause groups)` --conceptually_related_to--> `Level 1: JVM -XX:+DisableAttachMechanism`  [INFERRED]
  docs/dossier-optimisation.md → doc/anti-cheat-strategy.md
- `launcher.service.ts launch flow` --semantically_similar_to--> `launcher.service.ts launch orchestration`  [EXTRACTED] [semantically similar]
  doc/api/launcher/readme.md → docs/architecture/game-launch.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Defense in depth layers** — docs_security_security_model_integrity, docs_security_security_model_runtime, docs_security_security_model_transport, doc_anti_cheat_strategy_l0, doc_anti_cheat_strategy_l1 [INFERRED 0.75]
- **Server-client plugin channels** — docs_protocole_badge_utilisateurs_channel, docs_protocole_politique_modules_channel, apps_api_readme_api_service, docs_tuto_vps_serveur_plugin [INFERRED 0.85]
- **Game launch pipeline** — docs_architecture_game_launch_ensure_java21, docs_architecture_game_launch_minecraft_launcher_core, docs_architecture_game_launch_launcher_service, doc_api_microsoft_auth_readme_oauth [INFERRED 0.85]

## Communities (147 total, 51 thin omitted)

### Community 0 - "HUD editor (mod)"
Cohesion: 0.05
Nodes (13): HudEditor, MenuTheme, ModuleIcons, HudRow, FOND, OMBRE, OPACITE, TAILLE (+5 more)

### Community 1 - "Accounts store"
Cohesion: 0.06
Nodes (63): DB_PATH(), deduplicate(), deleteAccount(), ensureStore(), getAccount(), isExpired(), listAccounts(), normalizeUuid() (+55 more)

### Community 2 - "Background style (mod)"
Cohesion: 0.05
Nodes (13): BackgroundStyle, AUTO, NONE, OUTLINE, ROUNDED, SOLID, HudLayout, HudStyle (+5 more)

### Community 3 - "HUD elements (mod)"
Cohesion: 0.07
Nodes (15): EnumSetting, Module, ModuleCategory, COMBAT, HUD, OPTIMISATION, PARAMETRES, VISUEL (+7 more)

### Community 4 - "Launcher App shell"
Cohesion: 0.08
Nodes (43): App(), play(), AccountsScreen(), AccountsScreenProps, LogsScreen(), ScreenHeader(), SettingsScreen(), handleImportProfile() (+35 more)

### Community 6 - "Backend logger and paths"
Cohesion: 0.11
Nodes (44): logger, ensureInstanceLayout(), INSTANCE_SUBFOLDERS, instanceDir(), ensurePerformanceMods(), markerPath(), PERFORMANCE_MODS, PerformanceMod (+36 more)

### Community 7 - "Cape template generator"
Cohesion: 0.07
Nodes (24): build(), png(), scale(), bloc_code(), cellules(), corps_document(), _emets(), esc() (+16 more)

### Community 8 - "Discord RPC and Fabric download"
Cohesion: 0.07
Nodes (41): initDiscordRPC(), logger, setIdlePresence(), setPlayingPresence(), ensureFabric(), execFileAsync, cache, latestStableLoader() (+33 more)

### Community 9 - "Auth restore test"
Cohesion: 0.06
Nodes (35): charge(), DEUX_COMPTES, Faux, principal(), Reglage, sers(), verifie(), charge() (+27 more)

### Community 10 - "Keybinds import UI"
Cohesion: 0.09
Nodes (38): DetectedProfile, KeybindsImport(), pickFile(), run(), Source, DetectedProfile, DetectionSkeleton(), displayName() (+30 more)

### Community 11 - "Dependency overrides"
Cohesion: 0.05
Nodes (41): description, name, adm-zip@<0.6.0, adm-zip@<0.6.1, axios@>=1.0.0 <1.20.0, axios@>=1.12.0 <1.20.0, axios@>=1.13.0 <1.20.0, axios@>=1.15.0 <1.20.0 (+33 more)

### Community 12 - "Community 12"
Cohesion: 0.08
Nodes (24): ENV, DEFAULT_ALLOWED_ORIGINS, env, envSchema, parsed, app, ALL_TUNING_FLAGS, PAUSES_COURTES (+16 more)

### Community 13 - "Community 13"
Cohesion: 0.09
Nodes (6): ComboHud, CpsHud, ShieldHud, BooleanSetting, ColorSetting, HitIndicatorModule

### Community 14 - "Community 14"
Cohesion: 0.05
Nodes (36): dependencies, cors, dotenv, express, pino, pino-http, zod, devDependencies (+28 more)

### Community 15 - "Community 15"
Cohesion: 0.11
Nodes (33): installModpack(), ModpackError, installSchema, modpackSchema, modsRouter, searchSchema, contentDir(), downloadVersion() (+25 more)

### Community 16 - "Community 16"
Cohesion: 0.10
Nodes (27): serverStatusRouter, AppOverlays(), AppOverlaysProps, Modal(), DetectedProfile, ImportOptions, ProfileCreation(), ProfileCreationProps (+19 more)

### Community 17 - "Community 17"
Cohesion: 0.11
Nodes (26): BugReportModal(), handleSubmit(), BugReportModalProps, CATEGORIES, getGpuInfo(), useBootstrap(), bootstrap(), UseBootstrapOptions (+18 more)

### Community 18 - "Community 18"
Cohesion: 0.12
Nodes (7): MenuController, Mode, EDITION, FENETRE, ParanoiaMenu, ParanoiaMenuScreen, ParanoiaMenuScreen

### Community 19 - "Community 19"
Cohesion: 0.12
Nodes (27): Content, ContentRow(), remove(), toggle(), ContentSkeleton(), EMPTY, ProfileScreen(), replace() (+19 more)

### Community 20 - "Community 20"
Cohesion: 0.06
Nodes (30): dependencies, motion, react, react-dom, devDependencies, tailwindcss, @tailwindcss/vite, @types/react (+22 more)

### Community 21 - "Community 21"
Cohesion: 0.09
Nodes (20): App(), CARD_POSITIONS, GameUi(), GameUiProps, InstanceCard(), InstanceCardProps, SETTINGS_HEIGHTS, SETTINGS_TIMES (+12 more)

### Community 22 - "Community 22"
Cohesion: 0.06
Nodes (30): dependencies, motion, react, react-dom, devDependencies, tailwindcss, @tailwindcss/vite, @types/react (+22 more)

### Community 23 - "Community 23"
Cohesion: 0.11
Nodes (18): ExpandableNews(), ExpandableNewsProps, formatDate(), ModalProps, FALLBACK_STATUS, HomeScreen(), HomeScreenProps, useOutsideClick() (+10 more)

### Community 24 - "Community 24"
Cohesion: 0.14
Nodes (26): KINDS, ModsScreen(), install(), loadMore(), ModsScreenProps, Notice, ResultRow(), ResultsSkeleton() (+18 more)

### Community 25 - "Community 25"
Cohesion: 0.16
Nodes (3): Key, KeystrokesHud, Shapes

### Community 27 - "Community 27"
Cohesion: 0.11
Nodes (19): MANAGED_JAVA_TARGETS, ManagedJavaTarget, ParametresTab(), handleInstallAllJavas(), handleInstallJava(), handleSave(), ParametresTabProps, RAM_PRESETS (+11 more)

### Community 28 - "Community 28"
Cohesion: 0.10
Nodes (12): BACKEND_PORT, BackendProcess, DetectedProfile, ETIQUETTE_CONNEXION, get_detected_profiles(), main(), open_external_url(), open_instance_folder() (+4 more)

### Community 30 - "Community 30"
Cohesion: 0.16
Nodes (4): ApiException, Lookup, ParanoiaApi, Token

### Community 31 - "Community 31"
Cohesion: 0.08
Nodes (25): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+17 more)

### Community 32 - "Community 32"
Cohesion: 0.08
Nodes (24): @biomejs/biome, cors, dotenv, express, jszip, @paranoia/contracts, pino, pino-http (+16 more)

### Community 33 - "Community 33"
Cohesion: 0.14
Nodes (21): base, catalogRouter, createManifestSchema, getManifest(), installCatalogSchema, resolveLocalClientModArtifact(), validatedCatalog, CACHE_FILE() (+13 more)

### Community 34 - "Community 34"
Cohesion: 0.12
Nodes (23): CapePreview(), CATEGORIES, CosmeticItem, CosmeticsScreen(), act(), catalogType(), clearSlot(), CosmeticType (+15 more)

### Community 35 - "Community 35"
Cohesion: 0.12
Nodes (13): PNG_SIGNATURE, charge(), dossierJetable(), fauxJava(), fauxTout(), principal(), verifie(), applySodiumPreset() (+5 more)

### Community 36 - "Community 36"
Cohesion: 0.11
Nodes (7): MenuAccueilModule, Teinte, AMBRE, AMETHYSTE, CYAN, EMERAUDE, ROSE

### Community 37 - "Community 37"
Cohesion: 0.15
Nodes (5): CosmeticCapes, Patched, ParanoiaCapeAsset, PlayerListEntryMixin, PlayerListEntryMixin

### Community 39 - "Community 39"
Cohesion: 0.09
Nodes (22): @biomejs/biome, jszip, motion, @paranoia/contracts, react, react-dom, tailwindcss, @tailwindcss/vite (+14 more)

### Community 41 - "Community 41"
Cohesion: 0.15
Nodes (3): Rate, EntityRendererCullingMixin, EntityCullingModule

### Community 42 - "Community 42"
Cohesion: 0.23
Nodes (16): downloadArtifacts(), ensureClientMod(), findLocalClientMod(), removeOtherVersions(), runtimeDir(), ensureFabricApi(), findInstalledFabricApi(), removeOtherVersions() (+8 more)

### Community 43 - "Community 43"
Cohesion: 0.17
Nodes (4): ClientPlayNetworkHandlerMixin, InactivityFpsLimiterMixin, InGameHudMixin, ParticleManagerMixin

### Community 45 - "Community 45"
Cohesion: 0.14
Nodes (15): authRouter, completeSchema, VerifiedProfile, verifySession(), Express, Request, requireToken(), challenges (+7 more)

### Community 46 - "Community 46"
Cohesion: 0.19
Nodes (3): ArmorHud, Cell, CoordinatesHud

### Community 47 - "Community 47"
Cohesion: 0.22
Nodes (17): renouvelleAvecPatience(), surWindows(), useAuth(), handleDeleteAccount(), handleLogout(), handleMicrosoftConnect(), handleSwitchAccount(), restore() (+9 more)

### Community 48 - "Community 48"
Cohesion: 0.20
Nodes (16): cosmeticsRouter, equipSchema, purchaseSchema, balanceOf(), Catalog, catalogItems(), CosmeticDefinition, equippedFor() (+8 more)

### Community 49 - "Community 49"
Cohesion: 0.11
Nodes (18): scripts, build, build:sidecar, dev, format, lint, prisma:generate, prisma:migrate (+10 more)

### Community 51 - "Community 51"
Cohesion: 0.19
Nodes (3): InfoHud, Line, ServerTpsTracker

### Community 55 - "Community 55"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+9 more)

### Community 56 - "Community 56"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, allowSyntheticDefaultImports, esModuleInterop, forceConsistentCasingInFileNames, isolatedModules, jsx, lib (+9 more)

### Community 57 - "Community 57"
Cohesion: 0.15
Nodes (7): HudFont, SILKSCREEN, VANILLA, Panorama, NOCTURNE, SPAWN, VANILLA

### Community 58 - "Community 58"
Cohesion: 0.12
Nodes (3): CosmeticsCatalog, CosmeticsRegistry, CatalogItem

### Community 60 - "Community 60"
Cohesion: 0.21
Nodes (3): LightmapTextureManagerMixin, LivingEntityRendererMixin, PlayerListHudMixin

### Community 61 - "Community 61"
Cohesion: 0.15
Nodes (3): ParanoiaClient, VersionEntrypoint, VersionEntrypoint

### Community 63 - "Community 63"
Cohesion: 0.12
Nodes (17): dependencies, @fontsource-variable/inter, @fontsource-variable/space-grotesk, i18next, jszip, lucide-react, marked, motion (+9 more)

### Community 64 - "Community 64"
Cohesion: 0.16
Nodes (9): createApp(), httpLogger, rateLimit(), Window, assetsDir, cosmeticsFile, dataDir, stateFile (+1 more)

### Community 65 - "Community 65"
Cohesion: 0.15
Nodes (10): backendDir, main(), outDir, repoRoot, require, run(), scriptDir, targetTriple() (+2 more)

### Community 68 - "Community 68"
Cohesion: 0.12
Nodes (15): compilerOptions, esModuleInterop, exactOptionalPropertyTypes, forceConsistentCasingInFileNames, ignoreDeprecations, isolatedModules, module, moduleResolution (+7 more)

### Community 69 - "Community 69"
Cohesion: 0.13
Nodes (15): dependencies, adm-zip, axios, cors, discord-rpc, dotenv, express, jsonwebtoken (+7 more)

### Community 75 - "Community 75"
Cohesion: 0.23
Nodes (8): env, envSchema, parsed, logger, app, server, loadCosmetics(), watchCosmetics()

### Community 76 - "Community 76"
Cohesion: 0.27
Nodes (13): binaireDe(), Candidat, candidats(), detecteJava(), execFileAsync, javaInstallePour(), JavaTrouve, majorDepuisVersion() (+5 more)

### Community 77 - "Community 77"
Cohesion: 0.29
Nodes (12): checkConfig(), checkVersion(), collectImports(), collectTargets(), findInAncestors(), inspect(), main(), mixinFiles() (+4 more)

### Community 80 - "Community 80"
Cohesion: 0.24
Nodes (10): DangerZone(), duplicate(), FolderAction(), GeneralForm(), save(), InstanceSettings(), InstanceSettingsProps, SPRING (+2 more)

### Community 81 - "Community 81"
Cohesion: 0.24
Nodes (8): normalizeUuid(), loadState(), mutate(), State, statePath(), stateSchema, lookupSchema, usersRouter

### Community 82 - "Community 82"
Cohesion: 0.26
Nodes (10): ATTENDU_PARTOUT, cas(), JAMAIS, verifie(), applyGraphicsPreset(), LATENCE, markerPath(), PRESETS (+2 more)

### Community 83 - "Community 83"
Cohesion: 0.17
Nodes (10): connue(), declarations, fichiers(), here, HERITEES, manquants, MOTS_CLES, parents (+2 more)

### Community 86 - "Community 86"
Cohesion: 0.17
Nodes (12): devDependencies, autoprefixer, @biomejs/biome, postcss, tailwindcss, @tailwindcss/vite, @tauri-apps/cli, @types/react (+4 more)

### Community 87 - "Community 87"
Cohesion: 0.32
Nodes (11): RFC-6570, api(), args(), complet(), environnement(), JETON, manifeste(), plateformesConservees() (+3 more)

### Community 88 - "Community 88"
Cohesion: 0.17
Nodes (11): main, name, private, scripts, build, format, lint, typecheck (+3 more)

### Community 89 - "Community 89"
Cohesion: 0.18
Nodes (11): devDependencies, @biomejs/biome, esbuild, prisma, tsx, @types/cors, @types/discord-rpc, @types/express (+3 more)

### Community 91 - "Community 91"
Cohesion: 0.18
Nodes (8): launcher.service.ts launch flow, Per-OS JRE provisioning, Natives rule filtering and classpath separator, Runtime OS detection (std::env::consts), Tauri distribution (exe/msi, dmg, AppImage/deb) via tauri-action CI, ensureJava21 (Temurin JRE 21 download), launcher.service.ts launch orchestration, minecraft-launcher-core options

### Community 92 - "Community 92"
Cohesion: 0.24
Nodes (7): Plugin channel paranoia:users, Plugin channel paranoia:policy, Server plugin to block modules (Gradle build, install), Fabric client mod (Java 21), Paranoia Client Monorepo, PvP-first optimization rule, Signed remote config, no hardcoded mods

### Community 93 - "Community 93"
Cohesion: 0.20
Nodes (7): Microsoft OAuth2 flow, Auth endpoints /v1/auth/microsoft, Catalog endpoints /v1/catalog/remote-config, manifest, Launcher content: updates, cosmetics, news, server-status, Profiles endpoints /v1/profiles, Telemetry endpoints /v1/telemetry, Microsoft Azure app setup for OAuth

### Community 94 - "Community 94"
Cohesion: 0.28
Nodes (6): presenceRouter, isOnline(), online, onlineCount(), sweep, touch()

### Community 95 - "Community 95"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 96 - "Community 96"
Cohesion: 0.31
Nodes (7): backendRoot, catalogPath, collectJars(), walk(), main(), minecraftVersionOf(), sha256()

### Community 97 - "Community 97"
Cohesion: 0.22
Nodes (4): app, dataHome, png(), server

### Community 98 - "Community 98"
Cohesion: 0.22
Nodes (8): compilerOptions, module, moduleResolution, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 99 - "Community 99"
Cohesion: 0.22
Nodes (6): CSS, ecarts, here, JAVA, PAIRES, repo

### Community 100 - "Community 100"
Cohesion: 0.44
Nodes (8): get(), getJson(), main(), modRoot, resolveFabricApi(), resolveLoader(), resolveYarn(), targets()

### Community 103 - "Community 103"
Cohesion: 0.22
Nodes (9): Action, BOUTIQUE, MULTI, OPTIONS, PANORAMA, PARANOIA, QUITTER, SOLO (+1 more)

### Community 104 - "Community 104"
Cohesion: 0.28
Nodes (7): First setup sequence diagram, First setup flow (MS auth, version, profile type, graphics mode, recap), Install engine, Installation manifest (artifacts, URL, SHA-256, targetPath), Integrity control (SHA-256, signed manifest, rescan), Runtime controls (DLL injection detection, module monitoring), Transport security (TLS, short tokens, optional pinning)

### Community 107 - "Community 107"
Cohesion: 0.25
Nodes (5): Symbol, ETOILE, LETTRE, LOSANGE, POINT

### Community 108 - "Community 108"
Cohesion: 0.25
Nodes (5): Shape, CIRCLE, CROSS, DOT, TEE

### Community 109 - "Community 109"
Cohesion: 0.25
Nodes (8): scripts, build, dev, format, lint, preview, tauri, typecheck

### Community 110 - "Community 110"
Cohesion: 0.25
Nodes (3): @fontsource-variable/inter, @fontsource-variable/space-grotesk, i18next

### Community 111 - "Community 111"
Cohesion: 0.29
Nodes (6): i18n with react-i18next, Strict instance isolation (instances/ per profile), Offline fallback mode, RAM and JVM args settings, Tauri auto-updater, Requirements checklist (done/todo)

### Community 112 - "Community 112"
Cohesion: 0.25
Nodes (7): compilerOptions, declaration, outDir, rootDir, extends, include, ../../tsconfig.base.json

### Community 113 - "Community 113"
Cohesion: 0.29
Nodes (4): Antislop audit 001 (em dashes, focus indicators, contrast), GameUi React/Tailwind component from Figma Game UI frame, GameUi React/Tailwind component from Figma Game UI frame, Launcher (Tauri+Rust+React)

### Community 114 - "Community 114"
Cohesion: 0.29
Nodes (5): Paranoia API on VPS (who uses Paranoia), Mojang join/hasJoined auth flow, Privacy: no user list route, no persistence, lookup bodies never logged, Deploy API on VPS (DNS, Node 22, systemd, HTTPS), Backend API (Node/PostgreSQL)

### Community 115 - "Community 115"
Cohesion: 0.52
Nodes (6): importKeybinds(), KeybindImportError, KeybindImportResult, readKeybinds(), setOption(), styleOf()

### Community 116 - "Community 116"
Cohesion: 0.48
Nodes (6): describeSource(), fromMmcPack(), inspectSourceInstance(), readJson(), SourceDescription, SourceInstanceInfo

### Community 119 - "Community 119"
Cohesion: 0.29
Nodes (6): compilerOptions, jsx, noEmit, extends, include, ../../tsconfig.base.json

### Community 121 - "Community 121"
Cohesion: 0.48
Nodes (6): Java version imposed by Mojang; memory allocation, Ten JVM flags (short-pause vs rare-pause groups), Six performance mods; do not rebuild Sodium, Part 0: PvP-first admission rule, Sodium installed then configured (modify, not overwrite), Video settings with three forbidden ones

### Community 122 - "Community 122"
Cohesion: 0.43
Nodes (6): bumpCargoLock(), bumpCargoToml(), bumpJson(), JSON_FILES, main(), root

### Community 124 - "Community 124"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 125 - "Community 125"
Cohesion: 0.60
Nodes (5): Level 0: file cleanup and SHA-256 whitelist, Level 1: JVM -XX:+DisableAttachMechanism, Level 2: Windows process mitigation (signed DLLs only), Level 3: user-mode anti-cheat DLL hooking, Level 4: kernel-mode anti-cheat

### Community 126 - "Community 126"
Cohesion: 0.40
Nodes (3): Durability, POINTS, POURCENTAGE

### Community 127 - "Community 127"
Cohesion: 0.40
Nodes (3): Orientation, HORIZONTAL, VERTICAL

## Knowledge Gaps
- **139 isolated node(s):** `cors`, `dotenv`, `express`, `pino`, `pino-http` (+134 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 876 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **51 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `HudElement` connect `Community 59` to `HUD editor (mod)`, `Background style (mod)`, `HUD elements (mod)`, `Inventory rendering (mod)`, `Community 70`, `Community 38`, `Community 101`, `Community 40`, `Community 102`, `Community 105`, `Community 13`, `Community 46`, `Community 50`, `Community 51`, `Community 117`, `Community 25`, `Community 26`, `Community 57`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **What connects `cors`, `dotenv`, `express` to the rest of the system?**
  _139 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `HUD editor (mod)` be split into smaller, more focused modules?**
  _Cohesion score 0.05341055341055341 - nodes in this community are weakly interconnected._
- **Why does `Module` connect `HUD elements (mod)` to `HUD editor (mod)`, `Background style (mod)`, `Community 67`, `Community 36`, `Community 70`, `Community 38`, `Community 40`, `Community 41`, `Community 106`, `Community 13`, `Community 79`, `Community 52`, `Community 59`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Should `Accounts store` be split into smaller, more focused modules?**
  _Cohesion score 0.059125085440874914 - nodes in this community are weakly interconnected._
- **Why does `ModuleWindow` connect `HUD editor (mod)` to `Community 40`, `HUD elements (mod)`, `Community 18`, `Community 59`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Should `Background style (mod)` be split into smaller, more focused modules?**
  _Cohesion score 0.051587301587301584 - nodes in this community are weakly interconnected._
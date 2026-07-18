# Requirements Mapping -> Implementation

## First Setup

- [x] Step 1 Login (UI mandatory before proceeding)
- [x] Step 2 Select Minecraft version
- [x] Step 3 Select profile type from remote config
- [x] Step 4 Select graphics mode from remote config
- [x] Step 5 Installation: manifest creation + profile creation
- [x] Actual Microsoft OAuth (token exchange + account linking)

## Profile Management

- [x] Create
- [x] Delete
- [x] Duplicate
- [x] Favorite
- [x] Import/Export via API
- [ ] Rename dedicated endpoint (currently via PATCH)
- [ ] Import/Export local file in launcher UI
- [ ] RAM Configuration (min/max) and custom JVM arguments
- [ ] Strict instance isolation (separate folders per profile)

## Launcher

- [x] Tauri + React + TS base
- [x] Dark user interface with translucency effects (UI/UX)
- [x] SHA-256 Verification (native Rust command)
- [x] Fetch remote config
- [x] Dynamic manifest without hardcoded mods
- [ ] Cross-platform Support (Windows, Linux, macOS)
- [ ] Complete official Microsoft Auth
- [ ] Multi-account launcher support
- [ ] Offline Mode Support (Fallback)
- [ ] Parallel downloads + full resume capability
- [ ] Complete auto-installation of Java/Fabric
- [ ] Dynamic stable/beta branches
- [ ] Native Tauri Auto-Updater for the launcher
- [ ] Internationalization (i18n - EN/FR)
- [ ] Discord Rich Presence

## Backend

- [x] Modular REST API
- [x] Endpoints: catalog/profiles/news/server-status/cosmetics/updates/telemetry
- [x] Zod validation + JSON errors
- [x] Initial PostgreSQL Prisma schema
- [ ] Effective DB persistence (replace JSON store)
- [ ] Cryptographic signature for manifests

## Fabric Client

- [x] Base Java 21 + Fabric
- [x] Modular HudManager and core modules
- [x] Right Shift menu entry point pre-wired
- [ ] Complete drag-and-drop HUD editor
- [ ] Custom complete interface without vanilla screens
- [ ] Cosmetics synchronized at runtime

## Security

- [x] Centralized baseline rules
- [x] Pre-launch integrity check (SHA-256)
- [x] Endpoint security telemetry with consent
- [ ] Advanced runtime monitoring and complete anti-injection
- [ ] Automatic detection rules update

## Key Note

All version/type/mode combinations and the artifacts list are driven by remote configuration, not hardcoded in the launcher. Changing a modpack does not require a launcher release.

# Advanced Features

This document lists the additional technical features planned for the Paranoia launcher. The goal is to provide a complete, stable, and customizable client.

## 1. Launcher Auto-Updater (Tauri Updater)
Instead of forcing the user to manually download new versions of the launcher from the website, we will use Tauri's native system:
- The Tauri backend will regularly check for new versions against an API endpoint (e.g., `/v1/updates/launcher`).
- The interface will notify the user when an update is available.
- Downloading and replacing the binary will happen transparently.

## 2. Offline Fallback Mode
Microsoft Xbox Live authentication servers are occasionally subject to outages. To avoid penalizing players:
- The authentication system will cache the last valid session token and the player's profile.
- If the Microsoft API is unreachable, an "Offline" mode will be offered, allowing the player to access single-player mode or servers that do not require premium authentication.

## 3. RAM Management and JVM Arguments
Every PC is different, so it is essential to give the player the freedom to optimize their performance:
- The profile settings interface will include a slider to allocate RAM memory (Min / Max) by reading the total RAM available on the host system.
- An advanced text field will allow the addition of custom JVM arguments (e.g., specific Garbage Collector configuration).

## 4. Strict Instance Isolation
To prevent mod or configuration conflicts between different game versions:
- The root launcher folder (e.g., `.paranoia`) will contain an `instances/` subfolder.
- Each profile will have its own isolated folder with its own `mods/`, `saves/`, and `resourcepacks/`.
- This allows a player to switch from a "Vanilla 1.20" profile to a "Fabric PvP 1.19" profile without having to manually clear their mods folder.

## 5. Internationalization (i18n)
From the foundation of the React frontend, text must not be hardcoded:
- Use a library like `react-i18next`.
- Centralize language files (`en.json`, `fr.json`).
- This allows future international expansion of the project without having to rewrite the interface.

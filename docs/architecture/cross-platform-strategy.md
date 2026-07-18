# Cross-Platform Strategy (Windows, Linux, macOS)

This document details how the Paranoia launcher will handle native compatibility across different operating systems. Thanks to **Tauri (Rust + React)**, the application is fundamentally cross-platform, but the Minecraft ecosystem requires specific adjustments.

## 1. Application Distribution (Tauri)
Tauri allows compiling a native executable for each OS without relying on Node.js or Electron:
- **Windows**: Distributed via `.exe` or `.msi` (`x86_64-pc-windows-msvc` target).
- **macOS**: Distributed via compressed `.app` in a `.dmg` (supporting both Apple Silicon `aarch64` and Intel `x86_64`).
- **Linux**: Distributed via `.AppImage` or `.deb` packages.
- *Automation*: Compilation will be handled by CI/CD (GitHub Actions) using the `tauri-action` tool, generating all executables in a single release.

## 2. Runtime OS Detection
Upon launching, the Rust backend will detect the host operating system using native variables (`std::env::consts::OS` and `std::env::consts::ARCH`). This information will be used to:
- Determine standard installation directories (e.g., `%APPDATA%` on Windows, `~/.config` or `~/.local/share` on Linux, `~/Library/Application Support` on macOS).
- Send the correct `os` parameter to our remote API to fetch the appropriate configuration.

## 3. Java Environment (JRE) Provisioning
Running Minecraft requires Java, but the Java executable differs per OS:
- The remote configuration will return an OS-specific download URL (from Adoptium / Eclipse Temurin).
- The Rust backend will correctly extract the archive (typically `.zip` on Windows, and `.tar.gz` on Linux/macOS) and make the `java` binary executable (`chmod +x` on Unix systems).

## 4. Minecraft: Natives and Libraries
Minecraft's architecture relies on dynamic libraries (`.dll` for Windows, `.so` for Linux, `.dylib` for macOS) known as "natives":
- **Rule Filtering**: The Minecraft version JSON file contains compatibility rules. The Rust installation engine will parse these rules (e.g., `"os": {"name": "windows"}`) to skip downloading macOS/Linux libraries on a Windows machine (and vice versa).
- **Java Classpath**: When building the launch command `java -cp ...`, the backend will use the correct path separator:
  - **Windows**: Semicolon (`;`)
  - **Linux / macOS**: Colon (`:`)

## 5. Responsibilities Summary
| Task | Technology | Note |
|---|---|---|
| UI Interface | React / CSS | 100% agnostic, works everywhere. |
| Process & Files | Rust (Tauri) | Use `std::path::PathBuf` to avoid slash/backslash path issues. |
| Game Dependencies | Remote API | Must provide metadata for all 3 OS platforms. |

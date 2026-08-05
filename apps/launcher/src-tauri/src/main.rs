#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;
use serde::Serialize;
use std::path::Path;
use std::env;
use std::sync::Mutex;
use tauri::Manager;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

/// Port du backend embarque. Doit rester aligne avec PORT dans apps/backend et
/// avec le connect-src de la CSP dans tauri.conf.json.
const BACKEND_PORT: &str = "47820";

/// Garde le processus du backend pour pouvoir le tuer a la fermeture: sans ca,
/// il survivrait a la fenetre et bloquerait le port au prochain lancement.
struct BackendProcess(Mutex<Option<CommandChild>>);

#[tauri::command]
async fn download_and_verify(url: String, destination: String, expected_sha256: String) -> Result<(), String> {
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("download error: {e}"))?;

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("bytes error: {e}"))?;

    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let actual = hex::encode(hasher.finalize());

    if actual != expected_sha256.to_lowercase() {
        return Err("sha256 mismatch".into());
    }

    if let Some(parent) = std::path::Path::new(&destination).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create dir error: {e}"))?;
    }

    let mut file = fs::File::create(&destination).map_err(|e| format!("file create error: {e}"))?;
    file.write_all(&bytes)
        .map_err(|e| format!("file write error: {e}"))?;

    Ok(())
}

#[tauri::command]
async fn open_microsoft_login(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri::{Emitter, Manager};
    let app_handle = app.clone();
    
    // We run it on the main thread
    let _ = tauri::WebviewWindowBuilder::new(
        &app,
        "microsoft-login",
        tauri::WebviewUrl::External(url.parse().map_err(|e| format!("Invalid URL: {}", e))?),
    )
    .title("Connexion Microsoft")
    .inner_size(500.0, 600.0)
    .on_navigation(move |nav_url| {
        let url_str = nav_url.as_str();
        if url_str.starts_with("https://login.live.com/oauth20_desktop.srf") {
            let _ = app_handle.emit("microsoft-oauth-code", url_str);
            if let Some(window) = app_handle.get_webview_window("microsoft-login") {
                let _ = window.close();
            }
            return false;
        }
        true
    })
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[derive(Serialize)]
pub struct DetectedProfile {
    id: String,
    label: String,
    options_path: String,
    launcher: String,
}

#[tauri::command]
async fn get_detected_profiles() -> Result<Vec<DetectedProfile>, String> {
    let mut profiles = Vec::new();

    let appdata = env::var("APPDATA").unwrap_or_default();
    let userprofile = env::var("USERPROFILE").unwrap_or_default();

    // 1. Official Launcher
    if !appdata.is_empty() {
        let mc_dir = Path::new(&appdata).join(".minecraft");
        let profiles_json = mc_dir.join("launcher_profiles.json");
        if profiles_json.exists() {
            if let Ok(content) = fs::read_to_string(&profiles_json) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(profs) = v.get("profiles").and_then(|p| p.as_object()) {
                        for (k, v) in profs {
                            let name = v.get("name").and_then(|n| n.as_str()).unwrap_or(k);
                            let options_path = mc_dir.join("options.txt");
                            if options_path.exists() {
                                profiles.push(DetectedProfile {
                                    id: format!("official_{}", k),
                                    label: format!("Launcher Officiel : {}", name),
                                    options_path: options_path.to_string_lossy().into_owned(),
                                    launcher: "Minecraft Official Launcher".to_string(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Prism Launcher
    if !appdata.is_empty() {
        let prism_dir = Path::new(&appdata).join("PrismLauncher").join("instances");
        if prism_dir.exists() {
            if let Ok(entries) = fs::read_dir(prism_dir) {
                for entry in entries.flatten() {
                    let instance_dir = entry.path();
                    let mc_dir = instance_dir.join(".minecraft");
                    let options_path = mc_dir.join("options.txt");
                    if options_path.exists() {
                        let name = entry.file_name().to_string_lossy().into_owned();
                        profiles.push(DetectedProfile {
                            id: format!("prism_{}", name),
                            label: format!("Prism Launcher : {}", name),
                            options_path: options_path.to_string_lossy().into_owned(),
                            launcher: "Prism Launcher".to_string(),
                        });
                    }
                }
            }
        }
    }

    // 3. Modrinth App
    if !appdata.is_empty() {
        let modrinth_dir = Path::new(&appdata).join("ModrinthApp").join("profiles");
        if modrinth_dir.exists() {
            if let Ok(entries) = fs::read_dir(modrinth_dir) {
                for entry in entries.flatten() {
                    let profile_dir = entry.path();
                    let options_path = profile_dir.join("options.txt");
                    if options_path.exists() {
                        let name = entry.file_name().to_string_lossy().into_owned();
                        profiles.push(DetectedProfile {
                            id: format!("modrinth_{}", name),
                            label: format!("Modrinth App : {}", name),
                            options_path: options_path.to_string_lossy().into_owned(),
                            launcher: "Modrinth App".to_string(),
                        });
                    }
                }
            }
        }
    }

    // 4. CurseForge
    if !userprofile.is_empty() {
        let curse_dir = Path::new(&userprofile).join("curseforge").join("minecraft").join("Instances");
        if curse_dir.exists() {
            if let Ok(entries) = fs::read_dir(curse_dir) {
                for entry in entries.flatten() {
                    let instance_dir = entry.path();
                    let options_path = instance_dir.join("options.txt");
                    if options_path.exists() {
                        let name = entry.file_name().to_string_lossy().into_owned();
                        profiles.push(DetectedProfile {
                            id: format!("curseforge_{}", name),
                            label: format!("CurseForge : {}", name),
                            options_path: options_path.to_string_lossy().into_owned(),
                            launcher: "CurseForge App".to_string(),
                        });
                    }
                }
            }
        }
    }

    // 5. Lunar Client
    if !userprofile.is_empty() {
        let lunar_dir = Path::new(&userprofile).join(".lunarclient");
        if lunar_dir.exists() {
            profiles.push(DetectedProfile {
                id: "lunar_default".to_string(),
                label: "Lunar Client (Défaut)".to_string(),
                options_path: lunar_dir.to_string_lossy().into_owned(),
                launcher: "Lunar Client".to_string(),
            });
        }
    }

    // 6. MultiMC
    if !appdata.is_empty() {
        let multimc_dir = Path::new(&appdata).join("MultiMC").join("instances");
        if multimc_dir.exists() {
            if let Ok(entries) = fs::read_dir(multimc_dir) {
                for entry in entries.flatten() {
                    let instance_dir = entry.path();
                    let mc_dir = instance_dir.join(".minecraft");
                    let options_path = mc_dir.join("options.txt");
                    if options_path.exists() {
                        let name = entry.file_name().to_string_lossy().into_owned();
                        profiles.push(DetectedProfile {
                            id: format!("multimc_{}", name),
                            label: format!("MultiMC : {}", name),
                            options_path: options_path.to_string_lossy().into_owned(),
                            launcher: "MultiMC".to_string(),
                        });
                    }
                }
            }
        }
    }

    Ok(profiles)
}

/// Demarre le backend embarque et relaie sa sortie dans les logs de l'app.
fn spawn_backend(app: &tauri::AppHandle) -> Result<CommandChild, String> {
    let (mut rx, child) = app
        .shell()
        .sidecar("paranoia-server")
        .map_err(|e| format!("sidecar introuvable: {e}"))?
        .env("PORT", BACKEND_PORT)
        .spawn()
        .map_err(|e| format!("demarrage du backend impossible: {e}"))?;

    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                    print!("[backend] {}", String::from_utf8_lossy(&line));
                }
                CommandEvent::Terminated(payload) => {
                    eprintln!("[backend] arrete (code {:?})", payload.code);
                }
                _ => {}
            }
        }
    });

    Ok(child)
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(BackendProcess(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle();
            match spawn_backend(handle) {
                Ok(child) => {
                    let state = app.state::<BackendProcess>();
                    *state.0.lock().unwrap() = Some(child);
                }
                Err(err) => {
                    // On laisse l'interface s'ouvrir: elle affichera l'erreur de
                    // chargement, ce qui est plus parlant qu'une fenetre absente.
                    eprintln!("[backend] {err}");
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                if window.label() != "main" {
                    return;
                }
                // Le verrou est relache des la fin de cette instruction, avant
                // le kill: le garder plus longtemps ne compile pas.
                let child = window.state::<BackendProcess>().0.lock().unwrap().take();
                if let Some(child) = child {
                    let _ = child.kill();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![download_and_verify, get_detected_profiles, open_microsoft_login])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use sha2::{Digest, Sha256};
use std::env;
use std::fs;
use std::io::Write;
use std::path::Path;
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
async fn download_and_verify(
    url: String,
    destination: String,
    expected_sha256: String,
) -> Result<(), String> {
    let mut response = reqwest::get(&url)
        .await
        .map_err(|e| format!("download error: {e}"))?;

    if let Some(parent) = std::path::Path::new(&destination).parent() {
        fs::create_dir_all(parent).map_err(|e| format!("create dir error: {e}"))?;
    }

    let mut file = fs::File::create(&destination).map_err(|e| format!("file create error: {e}"))?;
    let mut hasher = Sha256::new();

    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|e| format!("chunk error: {e}"))?
    {
        hasher.update(&chunk);
        file.write_all(&chunk)
            .map_err(|e| format!("file write error: {e}"))?;
    }

    let actual = hex::encode(hasher.finalize());

    if actual != expected_sha256.to_lowercase() {
        drop(file);
        let _ = fs::remove_file(&destination);
        return Err("sha256 mismatch".into());
    }

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

/// Dossier de donnees du launcher, aligne sur apps/backend/src/modules/launcher/paths.ts.
fn paranoia_data_dir() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let appdata = env::var("APPDATA").ok()?;
        Some(Path::new(&appdata).join(".paranoia-client"))
    }
    #[cfg(target_os = "macos")]
    {
        let home = env::var("HOME").ok()?;
        Some(
            Path::new(&home)
                .join("Library")
                .join("Application Support")
                .join("paranoia-client"),
        )
    }
    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let base = env::var("XDG_DATA_HOME")
            .ok()
            .map(std::path::PathBuf::from)
            .or_else(|| {
                env::var("HOME")
                    .ok()
                    .map(|h| Path::new(&h).join(".local").join("share"))
            })?;
        Some(base.join("paranoia-client"))
    }
}

/// Ouvre une adresse web dans le navigateur du systeme.
///
/// La boutique vit sur le site, pas dans le launcher: un navigateur complet
/// apporte le gestionnaire de mots de passe et les moyens de paiement
/// enregistres, qu'une fenetre integree n'aurait pas.
#[tauri::command]
fn open_external_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    // Seul le web, et seulement en https. Sans ce filtre, l'interface pourrait
    // faire ouvrir un fichier ou un programme local par cette commande.
    if !url.starts_with("https://") {
        return Err("Adresse refusee: seules les adresses https sont ouvertes".into());
    }

    app.shell()
        .open(url, None)
        .map_err(|e| format!("Ouverture impossible: {e}"))
}

/// Ouvre le dossier d'un profil dans l'explorateur de fichiers du systeme.
#[tauri::command]
fn open_instance_folder(profile_id: String) -> Result<(), String> {
    // L'identifiant vient de l'interface: on refuse tout ce qui n'est pas un
    // identifiant simple, pour qu'il ne puisse pas designer un autre dossier.
    if profile_id.is_empty()
        || !profile_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
    {
        return Err("Identifiant de profil invalide".into());
    }

    let dir = paranoia_data_dir()
        .ok_or("Dossier de donnees introuvable")?
        .join("instances")
        .join(&profile_id);

    if !dir.is_dir() {
        return Err(format!("Dossier introuvable: {}", dir.display()));
    }

    let opened = if cfg!(target_os = "windows") {
        std::process::Command::new("explorer").arg(&dir).spawn()
    } else if cfg!(target_os = "macos") {
        std::process::Command::new("open").arg(&dir).spawn()
    } else {
        std::process::Command::new("xdg-open").arg(&dir).spawn()
    };

    opened.map_err(|e| format!("Ouverture impossible: {e}"))?;
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
        let curse_dir = Path::new(&userprofile)
            .join("curseforge")
            .join("minecraft")
            .join("Instances");
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
        let lunar_options_1 = lunar_dir
            .join("offline")
            .join("multiver")
            .join("options.txt");
        let lunar_options_2 = lunar_dir.join("settings").join("game").join("options.txt");

        let valid_lunar_options = if lunar_options_1.exists() {
            Some(lunar_options_1)
        } else if lunar_options_2.exists() {
            Some(lunar_options_2)
        } else {
            None
        };

        if let Some(opts) = valid_lunar_options {
            profiles.push(DetectedProfile {
                id: "lunar_default".to_string(),
                label: "Lunar Client".to_string(),
                options_path: opts.to_string_lossy().into_owned(),
                launcher: "Lunar Client".to_string(),
            });
        }
    }

    // 5.b Feather Client
    if !appdata.is_empty() {
        let feather_dir = Path::new(&appdata).join(".feather");
        let feather_options = feather_dir.join("user-profile").join("options.txt");
        if feather_options.exists() {
            profiles.push(DetectedProfile {
                id: "feather_default".to_string(),
                label: "Feather Client".to_string(),
                options_path: feather_options.to_string_lossy().into_owned(),
                launcher: "Feather Client".to_string(),
            });
        }
    }

    // 6. MultiMC & Forks (Prism Launcher, etc.)
    let multimc_forks = [
        ("MultiMC", "MultiMC"),
        ("PrismLauncher", "Prism Launcher"),
        ("ATLauncher", "ATLauncher"),
        ("gdlauncher_next", "GDLauncher"),
    ];

    if !appdata.is_empty() {
        for (dir_name, launcher_name) in multimc_forks.iter() {
            let instances_dir = Path::new(&appdata).join(dir_name).join("instances");
            if instances_dir.exists() {
                if let Ok(entries) = fs::read_dir(instances_dir) {
                    for entry in entries.flatten() {
                        let instance_dir = entry.path();
                        // GDLauncher et ATLauncher peuvent avoir la racine dans l'instance
                        let mut mc_dir = instance_dir.join(".minecraft");
                        if !mc_dir.exists() {
                            mc_dir = instance_dir.clone();
                        }

                        let options_path = mc_dir.join("options.txt");
                        if options_path.exists() {
                            let name = entry.file_name().to_string_lossy().into_owned();
                            profiles.push(DetectedProfile {
                                id: format!("{}_{}", dir_name, name),
                                label: format!("{} : {}", launcher_name, name),
                                options_path: options_path.to_string_lossy().into_owned(),
                                launcher: launcher_name.to_string(),
                            });
                        }
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
        .env("TAURI_SIDECAR", "true")
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
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
        .invoke_handler(tauri::generate_handler![
            download_and_verify,
            get_detected_profiles,
            open_microsoft_login,
            open_instance_folder,
            open_external_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

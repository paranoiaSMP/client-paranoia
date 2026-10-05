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

/// Numero de la prochaine fenetre de connexion, pour que son etiquette n'ait
/// jamais servi.
static OUVERTURES_CONNEXION: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(0);

/// Prefixe des etiquettes des fenetres de connexion Microsoft.
const ETIQUETTE_CONNEXION: &str = "microsoft-login";

/// Ouvre la fenetre de connexion Microsoft et rend son etiquette.
///
/// L'etiquette repart a l'interface, qui s'en sert pour reconnaitre la
/// fermeture de *sa* fenetre: sans elle, elle resterait a « Connexion... »,
/// tous ses boutons grises, lorsque le joueur referme la fenetre sans aller
/// jusqu'au bout.
#[tauri::command]
async fn open_microsoft_login(app: tauri::AppHandle, url: String) -> Result<String, String> {
    use std::sync::atomic::Ordering;
    use tauri::{Emitter, Manager};

    // Tauri refuse de construire une fenetre dont l'etiquette est deja prise,
    // et celle-ci etait fixe. Une fenetre de connexion encore ouverte -- celle
    // que l'ecran de connexion ouvrait de lui-meme au demarrage, par exemple,
    // souvent passee derriere la fenetre principale -- faisait donc echouer
    // toute ouverture suivante: « Ajouter un compte » ne montrait rien, et le
    // launcher semblait n'accepter qu'un seul compte.
    //
    // On ferme donc ce qui traine, et chaque ouverture porte son numero.
    // `destroy` et non `close`: la fermeture doit etre effective avant la
    // construction qui suit, sans attendre l'aller-retour d'un CloseRequested.
    for (etiquette, fenetre) in app.webview_windows() {
        if etiquette.starts_with(ETIQUETTE_CONNEXION) {
            let _ = fenetre.destroy();
        }
    }

    let etiquette = format!(
        "{ETIQUETTE_CONNEXION}-{}",
        OUVERTURES_CONNEXION.fetch_add(1, Ordering::Relaxed)
    );
    let a_fermer = etiquette.clone();
    let app_handle = app.clone();

    // We run it on the main thread
    let _ = tauri::WebviewWindowBuilder::new(
        &app,
        etiquette.as_str(),
        tauri::WebviewUrl::External(url.parse().map_err(|e| format!("Invalid URL: {}", e))?),
    )
    .title("Connexion Microsoft")
    .inner_size(500.0, 600.0)
    .on_navigation(move |nav_url| {
        let url_str = nav_url.as_str();
        if url_str.starts_with("https://login.live.com/oauth20_desktop.srf") {
            let _ = app_handle.emit("microsoft-oauth-code", url_str);
            if let Some(window) = app_handle.get_webview_window(a_fermer.as_str()) {
                let _ = window.close();
            }
            return false;
        }
        true
    })
    .build()
    .map_err(|e| e.to_string())?;

    Ok(etiquette)
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

    #[allow(deprecated)]
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
    let home = env::var("HOME").unwrap_or_default();
    let xdg_data = env::var("XDG_DATA_HOME").unwrap_or_else(|_| {
        if !home.is_empty() {
            format!("{}/.local/share", home)
        } else {
            String::new()
        }
    });

    // 1. Official Launcher
    let mut mc_dirs = Vec::new();
    if !appdata.is_empty() {
        mc_dirs.push(Path::new(&appdata).join(".minecraft"));
    }
    if !home.is_empty() {
        mc_dirs.push(Path::new(&home).join(".minecraft"));
        mc_dirs.push(Path::new(&home).join(".var/app/com.mojang.Minecraft/.minecraft"));
        mc_dirs.push(Path::new(&home).join("Library/Application Support/minecraft"));
    }

    for mc_dir in &mc_dirs {
        let profiles_json = mc_dir.join("launcher_profiles.json");
        if profiles_json.exists() {
            if let Ok(content) = fs::read_to_string(&profiles_json) {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(profs) = v.get("profiles").and_then(|p| p.as_object()) {
                        for (k, v) in profs {
                            let name = v.get("name").and_then(|n| n.as_str()).unwrap_or(k);
                            let options_path = mc_dir.join("options.txt");
                            if options_path.exists() {
                                let prof_id = format!("official_{}", k);
                                if !profiles.iter().any(|p: &DetectedProfile| p.id == prof_id) {
                                    profiles.push(DetectedProfile {
                                        id: prof_id,
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
    }

    // 2. Prism Launcher
    let mut prism_dirs = Vec::new();
    if !appdata.is_empty() {
        prism_dirs.push(Path::new(&appdata).join("PrismLauncher").join("instances"));
    }
    if !xdg_data.is_empty() {
        prism_dirs.push(Path::new(&xdg_data).join("PrismLauncher").join("instances"));
    }
    if !home.is_empty() {
        prism_dirs.push(Path::new(&home).join(".var/app/org.prismlauncher.PrismLauncher/data/PrismLauncher/instances"));
        prism_dirs.push(Path::new(&home).join("Library/Application Support/PrismLauncher/instances"));
    }

    for prism_dir in &prism_dirs {
        if prism_dir.exists() {
            if let Ok(entries) = fs::read_dir(prism_dir) {
                for entry in entries.flatten() {
                    let instance_dir = entry.path();
                    let mc_dir = instance_dir.join(".minecraft");
                    let options_path = mc_dir.join("options.txt");
                    if options_path.exists() {
                        let name = entry.file_name().to_string_lossy().into_owned();
                        let prof_id = format!("prism_{}", name);
                        if !profiles.iter().any(|p: &DetectedProfile| p.id == prof_id) {
                            profiles.push(DetectedProfile {
                                id: prof_id,
                                label: format!("Prism Launcher : {}", name),
                                options_path: options_path.to_string_lossy().into_owned(),
                                launcher: "Prism Launcher".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    // 3. Modrinth App
    let mut modrinth_dirs = Vec::new();
    if !appdata.is_empty() {
        modrinth_dirs.push(Path::new(&appdata).join("ModrinthApp").join("profiles"));
    }
    if !xdg_data.is_empty() {
        modrinth_dirs.push(Path::new(&xdg_data).join("ModrinthApp").join("profiles"));
    }
    if !home.is_empty() {
        modrinth_dirs.push(Path::new(&home).join(".var/app/com.modrinth.ModrinthApp/data/ModrinthApp/profiles"));
        modrinth_dirs.push(Path::new(&home).join("Library/Application Support/ModrinthApp/profiles"));
    }

    for modrinth_dir in &modrinth_dirs {
        if modrinth_dir.exists() {
            if let Ok(entries) = fs::read_dir(modrinth_dir) {
                for entry in entries.flatten() {
                    let profile_dir = entry.path();
                    let options_path = profile_dir.join("options.txt");
                    if options_path.exists() {
                        let name = entry.file_name().to_string_lossy().into_owned();
                        let prof_id = format!("modrinth_{}", name);
                        if !profiles.iter().any(|p: &DetectedProfile| p.id == prof_id) {
                            profiles.push(DetectedProfile {
                                id: prof_id,
                                label: format!("Modrinth App : {}", name),
                                options_path: options_path.to_string_lossy().into_owned(),
                                launcher: "Modrinth App".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    // 4. CurseForge
    let mut curse_dirs = Vec::new();
    if !userprofile.is_empty() {
        curse_dirs.push(Path::new(&userprofile).join("curseforge").join("minecraft").join("Instances"));
    }
    if !home.is_empty() {
        curse_dirs.push(Path::new(&home).join("curseforge").join("minecraft").join("Instances"));
        curse_dirs.push(Path::new(&home).join("Documents/curseforge/minecraft/Instances"));
    }

    for curse_dir in &curse_dirs {
        if curse_dir.exists() {
            if let Ok(entries) = fs::read_dir(curse_dir) {
                for entry in entries.flatten() {
                    let instance_dir = entry.path();
                    let options_path = instance_dir.join("options.txt");
                    if options_path.exists() {
                        let name = entry.file_name().to_string_lossy().into_owned();
                        let prof_id = format!("curseforge_{}", name);
                        if !profiles.iter().any(|p: &DetectedProfile| p.id == prof_id) {
                            profiles.push(DetectedProfile {
                                id: prof_id,
                                label: format!("CurseForge : {}", name),
                                options_path: options_path.to_string_lossy().into_owned(),
                                launcher: "CurseForge App".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    // 5. Lunar Client
    let mut lunar_dirs = Vec::new();
    if !userprofile.is_empty() {
        lunar_dirs.push(Path::new(&userprofile).join(".lunarclient"));
    }
    if !home.is_empty() {
        lunar_dirs.push(Path::new(&home).join(".lunarclient"));
    }

    for lunar_dir in &lunar_dirs {
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
            if !profiles.iter().any(|p: &DetectedProfile| p.id == "lunar_default") {
                profiles.push(DetectedProfile {
                    id: "lunar_default".to_string(),
                    label: "Lunar Client".to_string(),
                    options_path: opts.to_string_lossy().into_owned(),
                    launcher: "Lunar Client".to_string(),
                });
            }
            break;
        }
    }

    // 5.b Feather Client
    let mut feather_dirs = Vec::new();
    if !appdata.is_empty() {
        feather_dirs.push(Path::new(&appdata).join(".feather"));
    }
    if !home.is_empty() {
        feather_dirs.push(Path::new(&home).join(".feather"));
    }

    for feather_dir in &feather_dirs {
        let feather_options = feather_dir.join("user-profile").join("options.txt");
        if feather_options.exists() {
            if !profiles.iter().any(|p: &DetectedProfile| p.id == "feather_default") {
                profiles.push(DetectedProfile {
                    id: "feather_default".to_string(),
                    label: "Feather Client".to_string(),
                    options_path: feather_options.to_string_lossy().into_owned(),
                    launcher: "Feather Client".to_string(),
                });
            }
            break;
        }
    }

    // 6. MultiMC & Forks (Prism Launcher, etc.)
    let multimc_forks = [
        ("MultiMC", "MultiMC"),
        ("PrismLauncher", "Prism Launcher"),
        ("ATLauncher", "ATLauncher"),
        ("gdlauncher_next", "GDLauncher"),
    ];

    let mut base_dirs = Vec::new();
    if !appdata.is_empty() {
        base_dirs.push(Path::new(&appdata).to_path_buf());
    }
    if !xdg_data.is_empty() {
        base_dirs.push(Path::new(&xdg_data).to_path_buf());
    }

    for base_dir in &base_dirs {
        for (dir_name, launcher_name) in multimc_forks.iter() {
            let instances_dir = base_dir.join(dir_name).join("instances");
            if instances_dir.exists() {
                if let Ok(entries) = fs::read_dir(instances_dir) {
                    for entry in entries.flatten() {
                        let instance_dir = entry.path();
                        let mut mc_dir = instance_dir.join(".minecraft");
                        if !mc_dir.exists() {
                            mc_dir = instance_dir.clone();
                        }

                        let options_path = mc_dir.join("options.txt");
                        if options_path.exists() {
                            let name = entry.file_name().to_string_lossy().into_owned();
                            let prof_id = format!("{}_{}", dir_name, name);
                            if !profiles.iter().any(|p: &DetectedProfile| p.id == prof_id) {
                                profiles.push(DetectedProfile {
                                    id: prof_id,
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
                if window.label().starts_with(ETIQUETTE_CONNEXION) {
                    use tauri::Emitter;
                    // Le joueur a pu refermer la fenetre sans aller au bout.
                    // L'interface attendait alors un code qui ne viendrait
                    // jamais: elle restait a « Connexion... », bouton grise, et
                    // plus rien ne permettait d'ajouter un compte.
                    let _ = window
                        .app_handle()
                        .emit("microsoft-login-closed", window.label());
                    return;
                }

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

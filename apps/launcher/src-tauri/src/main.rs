#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use sha2::{Digest, Sha256};
use std::fs;
use std::io::Write;

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

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![download_and_verify])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

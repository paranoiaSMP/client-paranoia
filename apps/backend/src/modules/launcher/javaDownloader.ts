import axios from "axios";
import AdmZip from "adm-zip";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createWriteStream, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";

// Utilise l'API Adoptium (Eclipse Temurin) pour recuperer le JRE 21 HotSpot
const ADOPTIUM_API_LATEST_JRE_21_WIN = "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse";

export async function ensureJava21(
  targetDir: string, 
  onProgress: (status: string, percentage: number) => void
): Promise<string> {
  const javaHome = path.join(targetDir, "jre-21");
  const javawPath = path.join(javaHome, "bin", "javaw.exe");

  // Verifier si deja installe
  if (existsSync(javawPath)) {
    return javawPath;
  }

  onProgress("Telechargement de Java 21...", 0);
  
  // Creer le repertoire si manquant
  await fs.mkdir(targetDir, { recursive: true });
  
  const zipPath = path.join(targetDir, "jre-21.zip");

  // Etape 1: Telechargement avec progression
  const response = await axios({
    url: ADOPTIUM_API_LATEST_JRE_21_WIN,
    method: "GET",
    responseType: "stream"
  });

  const totalLength = parseInt((response.headers["content-length"] as string) || "0", 10);
  let downloadedLength = 0;

  response.data.on("data", (chunk: Buffer) => {
    downloadedLength += chunk.length;
    if (totalLength > 0) {
      const percentage = Math.round((downloadedLength / totalLength) * 100);
      onProgress(`Telechargement de Java 21...`, percentage);
    }
  });

  const writer = createWriteStream(zipPath);
  await pipeline(response.data, writer);

  // Etape 2: Extraction
  onProgress("Extraction de Java 21...", 100);
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(targetDir, true);

  // Etape 3: Renommer le dossier extrait (Adoptium extrait souvent dans un dossier style 'jdk-21.x.y-jre')
  const entries = await fs.readdir(targetDir);
  const extractedFolderName = entries.find(e => e.startsWith("jdk-21") && !e.endsWith(".zip"));

  if (!extractedFolderName) {
    throw new Error("Impossible de trouver le dossier Java extrait");
  }

  await fs.rename(path.join(targetDir, extractedFolderName), javaHome);
  
  // Nettoyer l'archive
  await fs.unlink(zipPath);

  if (!existsSync(javawPath)) {
    throw new Error("L'executable javaw.exe est introuvable apres l'installation");
  }

  return javawPath;
}

import axios from "axios";
import AdmZip from "adm-zip";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createWriteStream, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";

/*
 * UTILITAIRE DE TELECHARGEMENT JAVA
 * Ce module gere le telechargement et l'extraction automatique de l'environnement d'execution Java (JRE)
 * necessaire pour lancer Minecraft. Il s'appuie sur l'API Adoptium (Eclipse Temurin) pour recuperer
 * la version 21 HotSpot pour Windows x64.
 *
 * Fonctionnalites :
 * - Verification de l'existence de Java pour eviter les telechargements redondants
 * - Telechargement en streaming avec suivi de progression
 * - Extraction de l'archive ZIP
 * - Renommage et nettoyage post-installation
 */
const ADOPTIUM_API_LATEST_JRE_21_WIN =
  "https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jre/hotspot/normal/eclipse";

export async function ensureJava21(
  targetDir: string,
  onProgress: (status: string, percentage: number) => void,
): Promise<string> {
  const javaHome = path.join(targetDir, "jre-21");
  const javawPath = path.join(javaHome, "bin", "javaw.exe");

  if (existsSync(javawPath)) {
    return javawPath;
  }

  onProgress("Telechargement de Java 21...", 0);

  await fs.mkdir(targetDir, { recursive: true });

  const zipPath = path.join(targetDir, "jre-21.zip");

  const response = await axios({
    url: ADOPTIUM_API_LATEST_JRE_21_WIN,
    method: "GET",
    responseType: "stream",
  });

  const totalLength = parseInt(response.headers["content-length"] || "0", 10);
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

  onProgress("Extraction de Java 21...", 100);
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(targetDir, true);

  const entries = await fs.readdir(targetDir);
  const extractedFolderName = entries.find(
    (e) => e.startsWith("jdk-21") && !e.endsWith(".zip"),
  );

  if (!extractedFolderName) {
    throw new Error("Impossible de trouver le dossier Java extrait");
  }

  await fs.rename(path.join(targetDir, extractedFolderName), javaHome);

  await fs.unlink(zipPath);

  if (!existsSync(javawPath)) {
    throw new Error(
      "L'executable javaw.exe est introuvable apres l'installation",
    );
  }

  return javawPath;
}

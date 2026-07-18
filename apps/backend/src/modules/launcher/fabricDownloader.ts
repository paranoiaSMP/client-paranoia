import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { exec } from "node:child_process";
import util from "node:util";

const execPromise = util.promisify(exec);

const FABRIC_INSTALLER_URL = "https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.1/fabric-installer-1.0.1.jar";

export async function ensureFabric(
  rootPath: string,
  minecraftVersion: string,
  loaderVersion: string,
  onProgress: (text: string, percentage: number) => void
): Promise<string> {
  const customVersionName = `fabric-loader-${loaderVersion}-${minecraftVersion}`;
  const versionDirPath = path.join(rootPath, "versions", customVersionName);

  if (fs.existsSync(versionDirPath)) {
    onProgress(`Fabric ${loaderVersion} (MC ${minecraftVersion}) deja installe`, 100);
    return customVersionName;
  }

  const installerDir = path.join(rootPath, "installers");
  if (!fs.existsSync(installerDir)) {
    fs.mkdirSync(installerDir, { recursive: true });
  }

  const installerPath = path.join(installerDir, "fabric-installer.jar");

  if (!fs.existsSync(installerPath)) {
    onProgress("Telechargement de l'installateur Fabric...", 0);
    
    const response = await axios({
      url: FABRIC_INSTALLER_URL,
      method: "GET",
      responseType: "stream"
    });

    const totalLength = parseInt((response.headers["content-length"] as string) || "0", 10);
    let downloadedLength = 0;

    await new Promise<void>((resolve, reject) => {
      const writer = fs.createWriteStream(installerPath);
      response.data.on("data", (chunk: Buffer) => {
        downloadedLength += chunk.length;
        if (totalLength > 0) {
          const percentage = Math.round((downloadedLength / totalLength) * 100);
          onProgress(`Telechargement de l'installateur Fabric...`, percentage);
        }
      });
      writer.on("finish", () => resolve());
      writer.on("error", (err) => reject(err));
      response.data.pipe(writer);
    });
  }

  onProgress("Installation de Fabric...", 0);

  // Exécution de l'installateur Fabric (en utilisant la commande `java`)
  const command = `java -jar "${installerPath}" client -dir "${rootPath}" -mcversion ${minecraftVersion} -loader ${loaderVersion} -noprofile`;
  
  try {
    await execPromise(command);
  } catch (err) {
    console.error("Erreur lors de l'installation de Fabric", err);
    throw new Error(`Echec de l'installation de Fabric: ${err instanceof Error ? err.message : String(err)}`);
  }

  onProgress("Fabric installe avec succes", 100);
  return customVersionName;
}

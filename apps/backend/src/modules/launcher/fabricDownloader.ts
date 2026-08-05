import fs from "node:fs";
import path from "node:path";
import axios from "axios";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { pipeline } from "node:stream/promises";

const execFileAsync = promisify(execFile);

const FABRIC_INSTALLER_URL =
  "https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.1/fabric-installer-1.0.1.jar";

export async function ensureFabric(
  rootPath: string,
  minecraftVersion: string,
  loaderVersion: string,
  javaExecutable: string,
  onProgress: (text: string, percentage: number) => void,
): Promise<string> {
  const customVersionName = `fabric-loader-${loaderVersion}-${minecraftVersion}`;
  const versionDirPath = path.join(rootPath, "versions", customVersionName);

  if (fs.existsSync(versionDirPath)) {
    onProgress(
      `Fabric ${loaderVersion} (MC ${minecraftVersion}) deja installe`,
      100,
    );
    return customVersionName;
  }

  const installerDir = path.join(rootPath, "installers");
  await fs.promises.mkdir(installerDir, { recursive: true });

  const installerPath = path.join(installerDir, "fabric-installer.jar");

  if (!fs.existsSync(installerPath)) {
    onProgress("Telechargement de l'installateur Fabric...", 0);

    const response = await axios({
      url: FABRIC_INSTALLER_URL,
      method: "GET",
      responseType: "stream",
      maxRedirects: 5,
      timeout: 60_000,
    });

    const totalLength = Number.parseInt(
      (response.headers["content-length"] as string) || "0",
      10,
    );
    let downloadedLength = 0;

    response.data.on("data", (chunk: Buffer) => {
      downloadedLength += chunk.length;
      if (totalLength > 0) {
        onProgress(
          "Telechargement de l'installateur Fabric...",
          Math.round((downloadedLength / totalLength) * 100),
        );
      }
    });

    const partPath = `${installerPath}.part`;
    try {
      await pipeline(response.data, fs.createWriteStream(partPath));
      await fs.promises.rename(partPath, installerPath);
    } catch (err) {
      await fs.promises.unlink(partPath).catch(() => {});
      throw err;
    }
  }

  onProgress("Installation de Fabric...", 0);

  try {
    // execFile passe les arguments tels quels au lieu de les concatener dans une
    // ligne de shell: un chemin d'installation contenant un espace, un guillemet
    // ou un `&` ne peut plus casser ni detourner la commande.
    await execFileAsync(javaExecutable, [
      "-jar",
      installerPath,
      "client",
      "-dir",
      rootPath,
      "-mcversion",
      minecraftVersion,
      "-loader",
      loaderVersion,
      "-noprofile",
    ]);
  } catch (err) {
    console.error("Erreur lors de l'installation de Fabric", err);
    throw new Error(
      `Echec de l'installation de Fabric: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  onProgress("Fabric installe avec succes", 100);
  return customVersionName;
}

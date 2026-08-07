import axios from "axios";
import AdmZip from "adm-zip";
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createWriteStream, existsSync } from "node:fs";
import { pipeline } from "node:stream/promises";

const execFileAsync = promisify(execFile);


type JavaTarget = {
  /** Adoptium `os` path segment. */
  os: "windows" | "mac" | "linux";
  /** Adoptium `arch` path segment. */
  arch: "x64" | "aarch64";
  archive: "zip" | "tar.gz";
};

export type JavaInstall = {
  /** Root of the extracted runtime. */
  home: string;
  /** Console binary — use it when the process output has to be read. */
  java: string;
  /** Windowed binary (`javaw.exe`); same as `java` on macOS and Linux. */
  javaw: string;
};

function detectTarget(): JavaTarget {
  if (process.arch !== "x64" && process.arch !== "arm64") {
    throw new Error(
      `Architecture non supportee pour le telechargement de Java: ${process.arch}`,
    );
  }

  const arch: JavaTarget["arch"] = process.arch === "arm64" ? "aarch64" : "x64";

  switch (process.platform) {
    case "win32":
      return { os: "windows", arch, archive: "zip" };
    case "darwin":
      return { os: "mac", arch, archive: "tar.gz" };
    case "linux":
      return { os: "linux", arch, archive: "tar.gz" };
    default:
      throw new Error(
        `Systeme non supporte pour le telechargement de Java: ${process.platform}`,
      );
  }
}

function adoptiumUrl(major: number, target: JavaTarget): string {
  return (
    `https://api.adoptium.net/v3/binary/latest/${major}/ga/` +
    `${target.os}/${target.arch}/jre/hotspot/normal/eclipse`
  );
}

/**
 * Adoptium ships macOS runtimes with the binaries under `Contents/Home`,
 * while Windows and Linux keep them directly at the root.
 */
function installLayout(home: string): JavaInstall {
  if (process.platform === "win32") {
    return {
      home,
      java: path.join(home, "bin", "java.exe"),
      javaw: path.join(home, "bin", "javaw.exe"),
    };
  }

  const base =
    process.platform === "darwin" ? path.join(home, "Contents", "Home") : home;
  const java = path.join(base, "bin", "java");
  return { home, java, javaw: java };
}

async function extractArchive(
  archivePath: string,
  target: JavaTarget,
  destination: string,
): Promise<void> {
  if (target.archive === "zip") {
    new AdmZip(archivePath).extractAllTo(destination, true);
    return;
  }

  // tar est present d'origine sur macOS et Linux; adm-zip ne lit pas les .tar.gz.
  await execFileAsync("tar", ["-xzf", archivePath, "-C", destination]);
}

/**
 * Find the directory Adoptium extracted, whatever exact version it carries
 * (`jdk-21.0.5+11-jre`, `jdk-21.0.6+7-jre`, ...).
 */
async function findExtractedRuntime(
  targetDir: string,
  major: number,
  before: Set<string>,
): Promise<string> {
  const entries = await fs.readdir(targetDir, { withFileTypes: true });
  const candidate = entries.find(
    (entry) =>
      entry.isDirectory() &&
      !before.has(entry.name) &&
      // Java 8 s'extrait dans jdk8u..., les suivants dans jdk-17, jdk-21...
      (entry.name.startsWith(`jdk-${major}`) ||
        entry.name.startsWith(`jdk${major}u`)),
  );

  if (!candidate) {
    throw new Error("Impossible de trouver le dossier Java extrait");
  }

  return path.join(targetDir, candidate.name);
}

/**
 * Download and install the requested Java major under `targetDir`, reusing it
 * when already present.
 *
 * Runtimes live side by side (`jre-8`, `jre-17`, `jre-21`, ...): Minecraft
 * needs a different one depending on the version, and installing only Java 21
 * made every pre-1.20.5 profile fail to launch.
 */
export async function ensureJava(
  major: number,
  targetDir: string,
  onProgress: (status: string, percentage: number) => void,
): Promise<JavaInstall> {
  const javaHome = path.join(targetDir, `jre-${major}`);
  const existing = installLayout(javaHome);

  if (existsSync(existing.java)) {
    return existing;
  }

  const target = detectTarget();
  onProgress(`Telechargement de Java ${major}...`, 0);

  await fs.mkdir(targetDir, { recursive: true });
  const archivePath = path.join(targetDir, `jre-${major}.${target.archive}`);

  let response;
  try {
    response = await axios({
    url: adoptiumUrl(major, target),
    method: "GET",
    responseType: "stream",
    maxRedirects: 5,
    timeout: 120_000,
    });
  } catch (err) {
    // Adoptium ne publie pas toutes les majeures: un message clair vaut mieux
    // qu'une erreur reseau brute.
    throw new Error(
      `Java ${major} indisponible au telechargement (${target.os}/${target.arch}). ` +
        `Detail: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const totalLength = Number.parseInt(
    (response.headers["content-length"] as string) || "0",
    10,
  );
  let downloadedLength = 0;

  response.data.on("data", (chunk: Buffer) => {
    downloadedLength += chunk.length;
    if (totalLength > 0) {
      onProgress(
        `Telechargement de Java ${major}...`,
        Math.round((downloadedLength / totalLength) * 100),
      );
    }
  });

  await pipeline(response.data, createWriteStream(archivePath));

  onProgress(`Extraction de Java ${major}...`, 100);

  const before = new Set(
    (await fs.readdir(targetDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name),
  );

  await extractArchive(archivePath, target, targetDir);

  const extracted = await findExtractedRuntime(targetDir, major, before);
  await fs.rename(extracted, javaHome);
  await fs.unlink(archivePath);

  const install = installLayout(javaHome);
  if (!existsSync(install.java)) {
    throw new Error(
      `L'executable Java ${major} est introuvable apres l'installation (${install.java})`,
    );
  }

  if (process.platform !== "win32") {
    await fs.chmod(install.java, 0o755);
  }

  return install;
}

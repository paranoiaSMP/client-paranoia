/**
 * Build the backend into a single self-contained executable, then drop it where
 * Tauri expects sidecars (`src-tauri/binaries/<name>-<target-triple><ext>`).
 *
 * Two steps:
 *   1. esbuild bundles src/main.ts and its dependencies into one CommonJS file;
 *   2. Node's SEA support injects that bundle into a copy of the Node binary.
 *
 * The result needs no Node installed on the player's machine, which is the
 * whole point: the launcher ships its own API instead of expecting the user to
 * start one by hand.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const backendDir = resolve(scriptDir, "..");
const repoRoot = resolve(backendDir, "..", "..");
const workDir = join(backendDir, "dist-sidecar");
const outDir = join(repoRoot, "apps", "launcher", "src-tauri", "binaries");

const isWindows = process.platform === "win32";
const exeSuffix = isWindows ? ".exe" : "";
const BINARY_NAME = "paranoia-server";

/** Tauri matches sidecars by Rust target triple, so ask rustc for the real one. */
function targetTriple() {
  const output = execFileSync("rustc", ["-vV"], { encoding: "utf8" });
  const match = /^host:\s*(\S+)$/m.exec(output);
  if (!match) {
    throw new Error("Impossible de determiner la cible rustc (rustc -vV)");
  }
  return match[1];
}

function run(command, args, options = {}) {
  execFileSync(command, args, { stdio: "inherit", ...options });
}

async function main() {
  const triple = targetTriple();
  console.log(`[sidecar] cible: ${triple}`);

  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const bundlePath = join(workDir, "server.cjs");
  console.log("[sidecar] bundle esbuild...");
  // API JS plutot que la CLI: le shim d'esbuild ne se resout pas de facon
  // fiable depuis le store isole de pnpm.
  const esbuild = await import("esbuild");
  await esbuild.build({
    entryPoints: [join(backendDir, "src", "main.ts")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: bundlePath,
    logLevel: "info",
  });

  const seaConfigPath = join(workDir, "sea-config.json");
  const blobPath = join(workDir, "sea-prep.blob");
  writeFileSync(
    seaConfigPath,
    JSON.stringify(
      {
        main: bundlePath,
        output: blobPath,
        disableExperimentalSEAWarning: true,
      },
      null,
      2,
    ),
  );

  console.log("[sidecar] generation du blob SEA...");
  run(process.execPath, ["--experimental-sea-config", seaConfigPath]);

  const exePath = join(outDir, `${BINARY_NAME}-${triple}${exeSuffix}`);
  copyFileSync(process.execPath, exePath);

  if (isWindows) {
    // node.exe est signe: la signature devient invalide apres injection, mieux
    // vaut la retirer proprement. signtool n'est pas toujours dans le PATH,
    // l'echec n'est donc pas bloquant.
    try {
      run("signtool", ["remove", "/s", exePath], { stdio: "ignore" });
      console.log("[sidecar] signature d'origine retiree");
    } catch {
      console.log("[sidecar] signtool indisponible, signature laissee en l'etat");
    }
  }

  console.log("[sidecar] injection postject...");
  const postjectArgs = [
    "postject",
    exePath,
    "NODE_SEA_BLOB",
    blobPath,
    "--sentinel-fuse",
    "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2",
  ];
  if (process.platform === "darwin") {
    postjectArgs.push("--macho-segment-name", "NODE_SEA");
  }
  run("npx", ["--yes", ...postjectArgs], { shell: isWindows });

  if (!isWindows) {
    run("chmod", ["+x", exePath]);
  }

  console.log(`[sidecar] genere: ${exePath}`);
}

await main();

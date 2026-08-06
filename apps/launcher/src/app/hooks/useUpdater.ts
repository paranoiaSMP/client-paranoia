import { useCallback, useEffect, useState } from "react";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

export type UpdateState =
  | { status: "idle" }
  | { status: "available"; version: string; notes: string }
  | { status: "downloading"; percent: number }
  | { status: "ready" }
  | { status: "error"; message: string };

/**
 * Checks the release feed once at startup and exposes the update to the UI.
 *
 * The check runs in Rust and verifies the archive signature against the public
 * key in tauri.conf.json, so an unsigned or tampered build is rejected before
 * anything is installed.
 */
export function useUpdater() {
  const [state, setState] = useState<UpdateState>({ status: "idle" });
  const [update, setUpdate] = useState<Update | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function lookForUpdate() {
      try {
        const found = await check();
        if (cancelled || !found) {
          return;
        }

        setUpdate(found);
        setState({
          status: "available",
          version: found.version,
          notes: found.body ?? "",
        });
      } catch (err) {
        // Hors ligne, pas encore de release publiee, endpoint injoignable: rien
        // de tout cela ne doit empecher de jouer, on reste silencieux.
        console.warn("Verification de mise a jour impossible:", err);
      }
    }

    lookForUpdate();
    return () => {
      cancelled = true;
    };
  }, []);

  const install = useCallback(async () => {
    if (!update) {
      return;
    }

    try {
      let downloaded = 0;
      let total = 0;

      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case "Started":
            total = event.data.contentLength ?? 0;
            setState({ status: "downloading", percent: 0 });
            break;
          case "Progress":
            downloaded += event.data.chunkLength;
            setState({
              status: "downloading",
              percent: total > 0 ? Math.round((downloaded / total) * 100) : 0,
            });
            break;
          case "Finished":
            setState({ status: "ready" });
            break;
        }
      });

      await relaunch();
    } catch (err) {
      setState({
        status: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [update]);

  const dismiss = useCallback(() => setState({ status: "idle" }), []);

  return { state, install, dismiss };
}

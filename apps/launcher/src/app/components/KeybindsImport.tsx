import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { Keyboard, Loader2 } from "lucide-react";
import type { LauncherProfile } from "@paranoia/contracts";
import { importKeybinds, listProfiles } from "../../shared/api/profilesClient";

type DetectedProfile = { id: string; label: string; options_path: string; launcher: string };

type Source = { key: string; label: string; body: { sourceProfileId: string } | { sourceOptionsPath: string } };

/**
 * Reprend les touches d'une autre instance.
 *
 * <p>Les sources sont les autres instances de ce launcher et celles des
 * launchers detectes sur la machine; un fichier options.txt choisi a la main
 * couvre le reste. Seules les touches sont copiees: la langue, le son et les
 * graphismes de cette instance ne bougent pas.
 */
export function KeybindsImport({ profile }: { profile: LauncherProfile }) {
  const [sources, setSources] = useState<Source[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found: Source[] = [];
      try {
        for (const p of await listProfiles()) {
          if (p.id !== profile.id) {
            found.push({ key: `p:${p.id}`, label: `Cette appli : ${p.name}`, body: { sourceProfileId: p.id } });
          }
        }
      } catch {
        // Liste indisponible: les autres sources restent utilisables.
      }
      try {
        for (const d of await invoke<DetectedProfile[]>("get_detected_profiles")) {
          found.push({ key: `d:${d.id}`, label: d.label, body: { sourceOptionsPath: d.options_path } });
        }
      } catch {
        // Hors Tauri (navigateur de dev): pas de detection.
      }
      if (!cancelled) setSources(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile.id]);

  async function run(body: Source["body"]) {
    setBusy(true);
    setMessage(null);
    try {
      const result = await importKeybinds(profile.id, body);
      setMessage({
        ok: true,
        text:
          result.applied > 0
            ? `${result.applied} touche(s) importée(s).`
            : "Ces touches étaient déjà identiques.",
      });
    } catch (err) {
      setMessage({ ok: false, text: err instanceof Error ? err.message : "Import impossible" });
    } finally {
      setBusy(false);
    }
  }

  async function pickFile() {
    const file = await open({ multiple: false, filters: [{ name: "options.txt", extensions: ["txt"] }] });
    if (typeof file === "string") await run({ sourceOptionsPath: file });
  }

  const current = sources.find((s) => s.key === selected);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="m-0 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-400">
        <Keyboard className="size-3.5" />
        Touches
      </h3>
      <p className="m-0 text-[12.5px] leading-snug text-neutral-400">
        Reprends les touches d'une autre instance. Seules les touches sont copiées, pas la langue ni les graphismes.
      </p>

      <div className="flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Instance dont reprendre les touches</span>
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full cursor-pointer truncate rounded-md border border-divider bg-well px-3 py-2 text-[13.5px] text-ink outline-none transition-colors focus:border-accent"
          >
            <option value="">Choisir une instance</option>
            {sources.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!current || busy}
          onClick={() => current && run(current.body)}
          className="flex items-center gap-2 rounded-md border border-divider px-3.5 py-2 text-[13.5px] font-medium transition-colors hover:border-accent-700 hover:bg-well disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          Importer
        </button>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={pickFile}
        className="self-start text-[12.5px] text-accent-300 underline-offset-2 hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        ou choisir un fichier options.txt
      </button>

      <div aria-live="polite">
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`m-0 text-[12.5px] ${message.ok ? "text-neutral-200" : "text-danger"}`}>
            {message.text}
          </p>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Loader2, Shirt, Upload } from "lucide-react";

import { apiRequest } from "../../shared/api/http";

type Variant = "classic" | "slim";

interface SkinChangerProps {
  /** Montre ce skin dans l'apercu sans l'appliquer; `null` revient au skin du compte. */
  onPreview: (url: string | null) => void;
  /** Le compte porte maintenant ce skin. */
  onApplied: (url: string | undefined) => void;
}

/** Octets -> base64 sans depasser la pile d'appel sur un gros tableau. */
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Changement de skin du compte Minecraft.
 *
 * <p>Le skin se previsualise sur le personnage avant d'etre applique: il
 * change reellement sur le compte Mojang, donc partout, et on ne le defait
 * pas d'un clic une fois envoye.
 */
export function SkinChanger({ onPreview, onApplied }: SkinChangerProps) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<Variant>("classic");
  const [png, setPng] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [pending, setPending] = useState<"png" | "username" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const objectUrl = useRef<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function releaseObjectUrl() {
    if (objectUrl.current) {
      URL.revokeObjectURL(objectUrl.current);
      objectUrl.current = null;
    }
  }

  // Un apercu qui reste affiche apres la fermeture du panneau ferait croire
  // que le skin est deja applique.
  useEffect(() => () => releaseObjectUrl(), []);

  function reset() {
    releaseObjectUrl();
    setPng(null);
    setPending(null);
    setError(null);
    onPreview(null);
    if (fileInput.current) fileInput.current.value = "";
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.type !== "image/png") {
      setError("Choisis un fichier PNG.");
      return;
    }
    if (file.size > 24 * 1024) {
      setError("Image trop lourde: un skin pese moins de 24 Ko.");
      return;
    }

    releaseObjectUrl();
    objectUrl.current = URL.createObjectURL(file);
    setPng(toBase64(new Uint8Array(await file.arrayBuffer())));
    setPending("png");
    onPreview(objectUrl.current);
  }

  function previewUsername() {
    const name = username.trim();
    if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) {
      setError("Pseudo invalide.");
      return;
    }
    setError(null);
    releaseObjectUrl();
    setPng(null);
    setPending("username");
    onPreview(`https://minotar.net/skin/${name}`);
  }

  async function apply() {
    setBusy(true);
    setError(null);
    try {
      const body =
        pending === "png" ? { variant, png } : { variant, username: username.trim() };
      const result = await apiRequest<{ skin: { url: string } | null }>("/v1/skins", {
        method: "POST",
        body: JSON.stringify(body),
      });
      onApplied(result.skin?.url);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Changement impossible");
    } finally {
      setBusy(false);
    }
  }

  async function restoreDefault() {
    setBusy(true);
    setError(null);
    try {
      await apiRequest<void>("/v1/skins", { method: "DELETE" });
      onApplied(undefined);
      reset();
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Réinitialisation impossible");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-2 rounded-lg border border-divider bg-ground px-3 py-2 text-xs font-semibold text-ink transition-colors hover:border-accent"
      >
        <Shirt className="h-3.5 w-3.5" />
        Changer de skin
      </button>
    );
  }

  return (
    <div className="space-y-2.5 rounded-[14px] border border-divider bg-ground p-3">
      <input
        ref={fileInput}
        type="file"
        accept="image/png"
        hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => fileInput.current?.click()}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-divider bg-surface px-3 py-2 text-xs font-semibold text-ink hover:border-accent"
      >
        <Upload className="h-3.5 w-3.5" />
        Choisir un PNG
      </button>

      <div className="flex gap-1.5">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && previewUsername()}
          placeholder="ou le pseudo d'un joueur"
          maxLength={16}
          className="min-w-0 flex-1 rounded-lg border border-divider bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={previewUsername}
          className="rounded-lg border border-divider bg-surface px-2.5 text-xs font-semibold text-ink hover:border-accent"
        >
          Voir
        </button>
      </div>

      <div role="radiogroup" aria-label="Modèle de bras" className="grid grid-cols-2 gap-1.5">
        {(["classic", "slim"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={variant === v}
            onClick={() => setVariant(v)}
            className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold ${
              variant === v ? "border-accent text-ink" : "border-divider text-neutral-400"
            }`}
          >
            {v === "classic" ? "Bras larges (Steve)" : "Bras fins (Alex)"}
          </button>
        ))}
      </div>

      {error && <p className="text-[11px] text-red-400">{error}</p>}

      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={!pending || busy}
          onClick={() => void apply()}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-ink hover:bg-accent-600 disabled:opacity-50"
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" />}
          Appliquer
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="rounded-lg border border-divider px-3 py-2 text-xs font-semibold text-neutral-400 hover:text-ink"
        >
          Annuler
        </button>
      </div>

      <button
        type="button"
        disabled={busy}
        onClick={() => void restoreDefault()}
        className="w-full text-center text-[11px] text-neutral-500 hover:text-red-400 disabled:opacity-50"
      >
        Retirer mon skin personnalisé
      </button>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Infinity as InfinityIcon, Loader2, Lock, X } from "lucide-react";

import { apiRequest } from "../../../shared/api/http";
import { SkinViewer3D } from "../../../components/SkinViewer3D";
import { ScreenHeader } from "./ScreenHeader";

/**
 * Vestiaire: possession, achat et equipement des cosmetiques.
 *
 * <p>Tout passe par le sidecar local, jamais directement par le service
 * heberge: c'est lui qui detient le jeton d'API, et une webview n'a aucune
 * raison de le manipuler.
 */

type CosmeticType = "cape" | "wings" | "halo" | "hat" | "particle" | "emote";

interface CosmeticItem {
  id: string;
  type: CosmeticType;
  name: string;
  previewUrl: string;
  textureUrl?: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  price: number;
}

interface Profile {
  uuid: string;
  username: string;
  /** `null` = illimite (compte administrateur). */
  balance: number | null;
  admin: boolean;
  owned: string[];
  equipped: string[];
}

/**
 * Les raretes ne sont pas decoratives: elles disent en un coup d'oeil ce
 * qu'un objet vaut, avant meme d'avoir lu son prix. La couleur porte donc
 * l'information, et la bordure la rappelle sur la carte possedee.
 */
const RARITY: Record<CosmeticItem["rarity"], { label: string; color: string; glow: string }> = {
  common: { label: "Commun", color: "#8d84a8", glow: "rgba(139,139,150,.35)" },
  rare: { label: "Rare", color: "#4a9eff", glow: "rgba(74,158,255,.35)" },
  epic: { label: "Epique", color: "#8b5cf6", glow: "rgba(147,9,239,.45)" },
  legendary: { label: "Legendaire", color: "#ffb020", glow: "rgba(255,176,32,.45)" },
};

const CATEGORIES: { id: CosmeticType | "tout"; label: string }[] = [
  { id: "tout", label: "Tout" },
  { id: "cape", label: "Capes" },
  { id: "wings", label: "Ailes" },
  { id: "halo", label: "Aureoles" },
  { id: "hat", label: "Chapeaux" },
  { id: "particle", label: "Particules" },
  { id: "emote", label: "Emotes" },
];

/** Emplacements du casier, dans l'ordre ou on les porte. */
const SLOTS: { type: CosmeticType; label: string }[] = [
  { type: "cape", label: "Cape" },
  { type: "wings", label: "Ailes" },
  { type: "halo", label: "Aureole" },
  { type: "hat", label: "Chapeau" },
];

/**
 * Apercu fidele d'une texture de cape.
 *
 * <p>Une texture de cape est une boite depliee: afficher le PNG entier
 * montrerait la doublure et les tranches a cote du motif, ce qui ne
 * ressemble a rien. On ne cadre donc que la face exterieure -- la region
 * 10x16 a partir de (1,1) -- en agrandissant au pixel pres.
 */
function CapePreview({ url, size = 5 }: { url: string; size?: number }) {
  return (
    <div
      className="rounded-[6px] ring-1 ring-ink/10"
      style={{
        width: 10 * size,
        height: 16 * size,
        backgroundImage: `url(${url})`,
        backgroundSize: `${64 * size}px ${32 * size}px`,
        backgroundPosition: `-${1 * size}px -${1 * size}px`,
        backgroundRepeat: "no-repeat",
        imageRendering: "pixelated",
      }}
    />
  );
}

function Price({ value, owned }: { value: number; owned: boolean }) {
  if (owned) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4ade80]">
        <Check className="h-3 w-3" /> Possede
      </span>
    );
  }
  if (value === 0) {
    return <span className="text-[11px] font-semibold text-neutral-300">Offert</span>;
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink">
      <span className="grid h-3 w-3 place-items-center rounded-full bg-accent text-[8px] font-black">
        P
      </span>
      {value.toLocaleString("fr-FR")}
    </span>
  );
}

/**
 * Le catalogue survit a la fermeture du vestiaire.
 *
 * <p>Hors du composant, donc conserve entre deux ouvertures. C'est une vitrine
 * publique qui change quelques fois par semaine, alors que le vestiaire
 * s'ouvre et se ferme des dizaines de fois par session: le recharger a chaque
 * fois remplacait la grille par un sablier pour reafficher exactement la meme
 * chose.
 *
 * <p>Le profil, lui, n'est jamais mis en cache: le solde, les possessions et
 * l'equipement changent a chaque achat, et les montrer perimes serait pire que
 * de les faire attendre.
 */
let catalogCache: CosmeticItem[] | null = null;

export function CosmeticsScreen() {
  const [catalog, setCatalog] = useState<CosmeticItem[]>(catalogCache ?? []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [category, setCategory] = useState<CosmeticType | "tout">("tout");
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(catalogCache === null);
  const [skinUrl, setSkinUrl] = useState<string | undefined>();

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [items, me] = await Promise.all([
        apiRequest<CosmeticItem[]>("/v1/cosmetics/catalog"),
        apiRequest<Profile>("/v1/cosmetics/me"),
      ]);
      catalogCache = items;
      setCatalog(items);
      setProfile(me);

      // Le skin sert uniquement a l'apercu. Son absence n'est pas une
      // erreur: SkinViewer3D retombe sur Steve, et le vestiaire reste
      // utilisable.
      try {
        const accounts = await apiRequest<{ skinUrl?: string }[]>("/v1/auth/accounts");
        setSkinUrl(accounts[0]?.skinUrl);
      } catch {
        setSkinUrl(undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Un catalogue deja charge s'affiche immediatement; on le rafraichit quand
    // meme, mais en arriere-plan et sans ecran d'attente. Le sablier n'apparait
    // donc qu'a la toute premiere ouverture.
    //
    // Le vestiaire etait une fenetre par-dessus l'accueil, et cet effet
    // dependait de son ouverture. C'est maintenant un ecran: il se monte quand
    // on y va, et se demonte quand on le quitte. Le montage suffit.
    setLoading(catalogCache === null);
    void refresh();
  }, [refresh]);

  const owned = useMemo(() => new Set(profile?.owned ?? []), [profile]);
  const equipped = useMemo(() => new Set(profile?.equipped ?? []), [profile]);

  const visible = useMemo(
    () => (category === "tout" ? catalog : catalog.filter((item) => item.type === category)),
    [catalog, category],
  );

  const equippedByType = useMemo(() => {
    const map = new Map<CosmeticType, CosmeticItem>();
    for (const item of catalog) {
      if (equipped.has(item.id)) {
        map.set(item.type, item);
      }
    }
    return map;
  }, [catalog, equipped]);

  async function act(item: CosmeticItem) {
    setBusy(item.id);
    setError(null);

    try {
      if (!owned.has(item.id)) {
        await apiRequest("/v1/cosmetics/purchase", {
          method: "POST",
          body: JSON.stringify({ id: item.id }),
        });
      }

      // On enchaine sur l'equipement, y compris apres un achat: personne
      // n'achete un cosmetique pour le laisser au placard, et exiger un
      // second clic donnait l'impression que le premier n'avait rien fait.
      // Seul un objet deja porte se retire.
      const next =
        owned.has(item.id) && equipped.has(item.id)
          ? [...equipped].filter((id) => id !== item.id)
          : [...[...equipped].filter((id) => catalogType(id) !== item.type), item.id];

      await apiRequest("/v1/cosmetics/equipped", {
        method: "PUT",
        body: JSON.stringify({ ids: next }),
      });

      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  function catalogType(id: string): CosmeticType | undefined {
    return catalog.find((item) => item.id === id)?.type;
  }

  async function clearSlot(type: CosmeticType) {
    setBusy(`slot-${type}`);
    try {
      const next = [...equipped].filter((id) => catalogType(id) !== type);
      await apiRequest("/v1/cosmetics/equipped", {
        method: "PUT",
        body: JSON.stringify({ ids: next }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }

  const capeTexture = useMemo(() => {
    const cape = catalog.find((item) => item.type === "cape" && equipped.has(item.id));
    return cape?.textureUrl ?? cape?.previewUrl;
  }, [catalog, equipped]);

  const detail = selected ? catalog.find((item) => item.id === selected) : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-6">
      <ScreenHeader
        title="Cosmétiques"
        subtitle="Capes, ailes et effets visibles par les autres joueurs Paranoia."
      >
        {/* Le solde se tient a hauteur du titre: c'est la premiere chose qu'on
            verifie en arrivant, et la derniere avant d'acheter. */}
        <div className="flex items-center gap-2 rounded-md border border-divider bg-surface px-3 py-2">
          <span className="grid size-5 place-items-center rounded-full bg-gradient-to-br from-accent-600 to-accent-500 text-[10px] font-black text-accent-100">
            P
          </span>
          {profile?.balance === null ? (
            <span
              className="flex items-center gap-1 text-sm font-bold text-[#ffb020]"
              title="Compte administrateur : paracoins illimites"
            >
              <InfinityIcon className="h-4 w-4" />
            </span>
          ) : (
            <span className="text-sm font-bold tabular-nums">
              {(profile?.balance ?? 0).toLocaleString("fr-FR")}
            </span>
          )}
        </div>
      </ScreenHeader>

      {error && (
        <div className="shrink-0 rounded-md border border-danger/40 bg-danger/10 px-4 py-2.5 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="flex min-h-0 flex-1 gap-4">
            {/* ---- Rail des categories ---- */}
            <nav className="flex w-[190px] shrink-0 flex-col gap-1.5 rounded-[18px] border border-well bg-surface p-3">
              {CATEGORIES.map((entry) => {
                const count =
                  entry.id === "tout"
                    ? catalog.length
                    : catalog.filter((item) => item.type === entry.id).length;

                return (
                  <button
                    key={entry.id}
                    onClick={() => setCategory(entry.id)}
                    className={`flex items-center justify-between rounded-[12px] px-3.5 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      category === entry.id
                        ? "bg-gradient-to-r from-accent/25 to-transparent text-ink"
                        : "text-neutral-300 hover:bg-well hover:text-ink"
                    }`}
                  >
                    <span>{entry.label}</span>
                    <span className="text-xs tabular-nums text-neutral-500">{count}</span>
                  </button>
                );
              })}
            </nav>

            {/* ---- Grille ---- */}
            <section className="min-w-0 flex-1 overflow-y-auto rounded-[18px] border border-well bg-surface p-5">
              {loading ? (
                <div className="grid h-full place-items-center text-neutral-500">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : visible.length === 0 ? (
                <div className="grid h-full place-items-center px-8 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-sm font-semibold text-ink">Rien dans cette categorie</p>
                    <p className="max-w-[42ch] text-xs text-neutral-500">
                      Les cosmetiques apparaissent ici des qu'ils sont ajoutes au catalogue.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(158px,1fr))] gap-4">
                  {visible.map((item) => {
                    const isOwned = owned.has(item.id);
                    const isWorn = equipped.has(item.id);
                    const rarity = RARITY[item.rarity];
                    const working = busy === item.id;
                    const affordable =
                      isOwned || profile?.balance === null || (profile?.balance ?? 0) >= item.price;

                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelected(item.id);
                          void act(item);
                        }}
                        disabled={working || !affordable}
                        className={`group relative flex flex-col overflow-hidden rounded-[18px] border-2 bg-gradient-to-br from-[#282141] via-[#1d1d21] to-[#161619] p-3 text-left transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                          isWorn
                            ? "border-accent"
                            : "border-divider hover:border-neutral-700 disabled:hover:border-divider"
                        } ${!affordable ? "cursor-not-allowed opacity-55" : ""}`}
                      >
                        {/* Lueur de rarete, discrete tant que l'objet n'est pas porte */}
                        <span
                          className="pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl transition-opacity"
                          style={{
                            background: rarity.glow,
                            opacity: isWorn ? 0.9 : 0.25,
                          }}
                        />

                        <div className="relative mb-3 grid h-[104px] place-items-center">
                          {item.type === "cape" ? (
                            <CapePreview url={item.textureUrl ?? item.previewUrl} size={5} />
                          ) : (
                            <img
                              src={item.previewUrl}
                              alt=""
                              className="max-h-[96px] max-w-full object-contain"
                              style={{ imageRendering: "pixelated" }}
                            />
                          )}

                          {working && (
                            <span className="absolute inset-0 grid place-items-center rounded-[12px] bg-black/50">
                              <Loader2 className="h-5 w-5 animate-spin text-ink" />
                            </span>
                          )}

                          {!affordable && !working && (
                            <span className="absolute inset-0 grid place-items-center rounded-[12px] bg-black/45">
                              <Lock className="h-5 w-5 text-neutral-300" />
                            </span>
                          )}
                        </div>

                        <span className="relative truncate text-sm font-semibold text-ink">
                          {item.name}
                        </span>

                        <span className="relative mt-0.5 flex items-center justify-between gap-2">
                          <Price value={item.price} owned={isOwned} />
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: rarity.color }}
                          >
                            {rarity.label}
                          </span>
                        </span>

                        {isWorn && (
                          <span className="relative mt-2 rounded-[8px] bg-accent py-1 text-center text-[11px] font-bold text-ink">
                            EQUIPE
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ---- Casier ---- */}
            <aside className="flex w-[264px] shrink-0 flex-col gap-4 rounded-[18px] border border-well bg-surface p-5">
              <div className="flex items-baseline justify-between">
                <h3 className="text-sm font-bold tracking-tight text-ink">Casier</h3>
                {profile && (
                  <span className="truncate text-xs text-neutral-500">{profile.username}</span>
                )}
              </div>

              {/* Le personnage porte reellement ce qui est equipe: c'est le
                  seul apercu qui dit la verite sur le rendu en jeu, avec la
                  physique de cape que Minecraft applique. */}
              <div className="h-[210px] shrink-0 overflow-hidden rounded-[14px] border border-divider bg-gradient-to-b from-[#1c1a24] to-surface">
                {/* Les props sont posees conditionnellement plutot que
                    passees a undefined: le projet compile avec
                    exactOptionalPropertyTypes, qui distingue « absent » de
                    « present valant undefined ». Ici la distinction sert --
                    absent laisse le composant appliquer ses defauts. */}
                <SkinViewer3D
                  {...(skinUrl ? { skinUrl } : {})}
                  {...(capeTexture ? { capeUrl: capeTexture } : {})}
                  animation="idle"
                  className="h-full w-full"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {SLOTS.map((slot) => {
                  const worn = equippedByType.get(slot.type);
                  const working = busy === `slot-${slot.type}`;

                  return (
                    <div
                      key={slot.type}
                      className={`relative flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[14px] border-2 p-2 transition-colors ${
                        worn
                          ? "border-accent bg-gradient-to-br from-[#3a1a57] via-[#231430] to-[#17151b]"
                          : "border-dashed border-neutral-700 bg-ground"
                      }`}
                    >
                      {worn ? (
                        <>
                          {slot.type === "cape" ? (
                            <CapePreview url={worn.textureUrl ?? worn.previewUrl} size={3} />
                          ) : (
                            <img
                              src={worn.previewUrl}
                              alt=""
                              className="max-h-[48px] object-contain"
                              style={{ imageRendering: "pixelated" }}
                            />
                          )}
                          <span className="w-full truncate text-center text-[10px] font-medium text-ink">
                            {worn.name}
                          </span>
                          <button
                            onClick={() => void clearSlot(slot.type)}
                            disabled={working}
                            aria-label={`Retirer ${worn.name}`}
                            className="absolute top-1.5 right-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-neutral-300 transition-colors hover:bg-black/80 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                          >
                            {working ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </button>
                        </>
                      ) : (
                        <span className="text-[11px] font-medium text-neutral-700">{slot.label}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {detail && (
                <div className="mt-auto rounded-[14px] border border-divider bg-ground p-3.5">
                  <p className="text-sm font-semibold text-ink">{detail.name}</p>
                  <p className="mt-0.5 text-xs" style={{ color: RARITY[detail.rarity].color }}>
                    {RARITY[detail.rarity].label}
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-neutral-400">
                    {owned.has(detail.id)
                      ? equipped.has(detail.id)
                        ? "Porte. Clique de nouveau pour le retirer."
                        : "Possede. Clique pour l'equiper."
                      : detail.price === 0
                        ? "Offert. Clique pour l'obtenir."
                        : `Coute ${detail.price.toLocaleString("fr-FR")} paracoins.`}
                  </p>
                </div>
              )}

              {profile?.admin && (
                <p className="rounded-[12px] border border-[#ffb020]/25 bg-[#ffb020]/10 px-3 py-2 text-[11px] leading-relaxed text-[#ffb020]">
                  Compte administrateur : paracoins illimites, rien ne t'est facture.
                </p>
              )}
            </aside>
      </div>
    </div>
  );
}

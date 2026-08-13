import { useRef } from "react";
import {
  Box,
  ChevronLeft,
  ChevronRight,
  Package,
  Settings,
  Shirt,
  ShoppingBag,
  FolderOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type HomeAction =
  | "cosmetiques"
  | "boutique"
  | "mods"
  | "instances"
  | "parametres"
  | "dossier";

type HomeActionBarProps = {
  onAction: (action: HomeAction) => void;
  modCount: number | null;
  instanceCount: number;
};

/** Raccourcis de la piste defilante. La boutique n'en fait pas partie. */
const ACTIONS: { id: HomeAction; label: string; icon: LucideIcon }[] = [
  { id: "cosmetiques", label: "Cosmetiques", icon: Shirt },
  { id: "mods", label: "Mods", icon: Package },
  { id: "instances", label: "Instances", icon: Box },
  { id: "parametres", label: "Parametres", icon: Settings },
  { id: "dossier", label: "Dossier", icon: FolderOpen },
];

/** Largeur d'un bouton plus l'espace qui le suit: un cran de defilement. */
const STEP = 128;

/**
 * Barre d'actions de l'accueil.
 *
 * <p>La boutique est ancree a droite, hors de la piste: c'est le seul bouton
 * qui doit rester atteignable sans rien faire defiler. Les autres tiennent sur
 * une piste large de trois, que la molette fait defiler -- les fleches sont la
 * pour que ce defilement se voie, une piste sans indice ne s'essaie pas.
 *
 * <p>La barre est {@code sticky}: elle reste en place quand le contenu defile
 * sous elle.
 */
export function HomeActionBar({
  onAction,
  modCount,
  instanceCount,
}: HomeActionBarProps) {
  const track = useRef<HTMLDivElement>(null);

  function scrollBy(direction: 1 | -1) {
    track.current?.scrollBy({ left: direction * STEP, behavior: "smooth" });
  }

  return (
    <div className="sticky top-0 z-30 flex h-[64px] w-full lg:w-[75%] shrink-0 items-center gap-2 rounded-[20px] border border-[#2e2e33] bg-[#1b1b20]/95 px-3 backdrop-blur">
      <button
        onClick={() => scrollBy(-1)}
        aria-label="Raccourcis precedents"
        type="button"
        className="grid h-8 w-6 shrink-0 place-items-center rounded-[8px] text-[#71717a] transition-colors hover:bg-[#26262b] hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* Piste: trois boutons visibles, la molette fait defiler les autres. */}
      <div
        ref={track}
        onWheel={(event) => {
          // La molette d'une souris ne produit que du deplacement vertical:
          // sans cette conversion, la piste ne bougerait pas d'un pixel.
          if (event.deltaY !== 0) {
            event.currentTarget.scrollLeft += event.deltaY;
          }
        }}
        className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto scroll-smooth"
      >
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const badge =
            action.id === "mods"
              ? modCount
              : action.id === "instances"
                ? instanceCount
                : null;

          return (
            <button
              key={action.id}
              onClick={() => onAction(action.id)}
              title={action.label}
              type="button"
              className="flex h-11 w-[120px] shrink-0 items-center justify-center gap-2 rounded-[10px] border border-[#333] bg-[#232328] px-3 text-xs font-semibold text-[#d4d4d8] transition-colors hover:border-[#9309ef] hover:text-white"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{action.label}</span>
              {badge !== null && badge > 0 && (
                <span className="shrink-0 rounded-full bg-[#0f0f12] px-1.5 py-0.5 text-[10px] font-bold text-[#a1a1aa]">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={() => scrollBy(1)}
        aria-label="Raccourcis suivants"
        type="button"
        className="grid h-8 w-6 shrink-0 place-items-center rounded-[8px] text-[#71717a] transition-colors hover:bg-[#26262b] hover:text-white"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div className="h-8 w-px shrink-0 bg-[#2e2e33]" />

      {/* Boutique: ancree a droite, hors de la piste, toujours visible. */}
      <button
        onClick={() => onAction("boutique")}
        title="Boutique Paranoia"
        type="button"
        className="flex h-11 shrink-0 items-center gap-2.5 rounded-[12px] border border-[#9309ef]/60 bg-gradient-to-br from-[#9309ef]/25 to-[#61069e]/15 px-3 text-white transition-colors hover:from-[#9309ef]/40 hover:to-[#61069e]/25"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-gradient-to-br from-[#9309ef] to-[#61069e] shadow-lg shadow-[#9309ef]/20">
          <ShoppingBag className="h-4 w-4" />
        </span>
        <span className="hidden sm:inline text-xs font-bold uppercase tracking-wide">
          Boutique
        </span>
      </button>

    </div>
  );
}

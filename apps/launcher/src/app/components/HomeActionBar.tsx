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

/** Largeur d'un bouton, et espace qui le suit. */
const BUTTON = 120;
const GAP = 8;

/** Un cran de defilement: un bouton. */
const STEP = BUTTON + GAP;

/**
 * Largeur maximale de la piste, calee sur quatre boutons.
 *
 * <p>C'est un plafond et non une largeur fixe. En largeur fixe, la piste ne
 * retrecissait pas: sur une fenetre etroite elle debordait de la barre et
 * poussait la boutique hors du cadre. Le plafond garde le compte voulu quand
 * la place existe, et la piste se resserre quand elle manque -- la molette et
 * les fleches restent le moyen d'atteindre le reste dans les deux cas.
 */
const TRACK_WIDTH = BUTTON * 4 + GAP * 3;

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
    <div className="sticky top-0 z-30 flex h-[64px] w-full shrink-0 items-center gap-2 rounded-[22px] bubble px-3 backdrop-blur">
      <button
        onClick={() => scrollBy(-1)}
        aria-label="Raccourcis precedents"
        type="button"
        className="grid h-8 w-6 shrink-0 place-items-center rounded-[8px] text-[#7a7194] transition-colors hover:bg-[#282141] hover:text-white"
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
        style={{ maxWidth: TRACK_WIDTH }}
        className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scroll-smooth"
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
              className="flex h-11 w-[120px] shrink-0 items-center justify-center gap-2 rounded-[10px] border border-[#2c2447] bg-[#241d3c] px-3 text-xs font-semibold text-[#cfc9de] transition-colors hover:border-[#8b5cf6] hover:text-white"
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{action.label}</span>
              {badge !== null && badge > 0 && (
                <span className="shrink-0 rounded-full bg-[#100c1c] px-1.5 py-0.5 text-[10px] font-bold text-[#9a92b6]">
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
        className="grid h-8 w-6 shrink-0 place-items-center rounded-[8px] text-[#7a7194] transition-colors hover:bg-[#282141] hover:text-white"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div className="ml-auto h-8 w-px shrink-0 bg-[#292142]" />

      {/* Boutique: ancree a droite, hors de la piste, toujours visible. */}
      <button
        onClick={() => onAction("boutique")}
        title="Boutique Paranoia"
        type="button"
        className="flex h-11 shrink-0 items-center gap-2.5 rounded-[12px] border border-[#8b5cf6]/60 bg-gradient-to-br from-[#8b5cf6]/25 to-[#6d35e0]/15 px-3 text-white transition-colors hover:from-[#8b5cf6]/40 hover:to-[#6d35e0]/25"
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] bg-gradient-to-br from-[#8b5cf6] to-[#6d35e0] shadow-lg shadow-[#8b5cf6]/20">
          <ShoppingBag className="h-4 w-4" />
        </span>
        {/* Le libelle ne reapparait qu'a partir de lg. La barre ne couvre plus
            que la colonne de gauche depuis que le panneau du personnage monte
            jusqu'en haut: sur une fenetre moyenne, ces quatre-vingt-dix pixels
            de texte coutaient un raccourci entier dans la piste, alors que
            l'icone du sac suffit a reconnaitre la boutique. */}
        <span className="hidden lg:inline text-xs font-bold uppercase tracking-wide">
          Boutique
        </span>
      </button>

    </div>
  );
}

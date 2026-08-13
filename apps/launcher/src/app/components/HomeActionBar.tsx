import {
  Box,
  Package,
  Settings,
  Shirt,
  ShoppingBag,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type HomeAction = "cosmetiques" | "boutique" | "mods" | "instances" | "parametres";

type HomeActionBarProps = {
  onAction: (action: HomeAction) => void;
  modCount: number | null;
  instanceCount: number;
};

const ACTIONS: {
  id: HomeAction;
  label: string;
  icon: LucideIcon;
  accent?: boolean;
}[] = [
  { id: "cosmetiques", label: "Cosmetiques", icon: Shirt },
  { id: "boutique", label: "Boutique", icon: ShoppingBag, accent: true },
  { id: "mods", label: "Mods", icon: Package },
  { id: "instances", label: "Instances", icon: Box },
  { id: "parametres", label: "Parametres", icon: Settings },
];

/**
 * Barre d'actions en haut de l'accueil.
 *
 * <p>Elle est {@code sticky}: elle reste en place quand le contenu defile sous
 * elle, y compris sur une fenetre courte ou la liste des instances deborde.
 * Le logo tient a gauche, les raccourcis a droite.
 */
export function HomeActionBar({
  onAction,
  modCount,
  instanceCount,
}: HomeActionBarProps) {
  return (
    <div className="sticky top-0 z-30 flex h-[64px] w-full lg:w-[75%] shrink-0 items-center gap-3 overflow-x-auto rounded-[20px] border border-[#2e2e33] bg-[#1b1b20]/95 px-4 backdrop-blur">
      {/* Logo */}
      <div className="flex shrink-0 items-center gap-2.5 pr-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-gradient-to-br from-[#9309ef] to-[#61069e] text-sm font-black text-white shadow-lg shadow-[#9309ef]/20">
          P
        </div>
        <div className="hidden sm:block leading-tight">
          <p className="text-sm font-black text-white">PARANOIA</p>
          <p className="text-[9px] font-bold uppercase tracking-widest text-accent-purple">
            Client
          </p>
        </div>
      </div>

      <div className="h-8 w-px shrink-0 bg-[#2e2e33]" />

      {/* Raccourcis */}
      <div className="flex items-center gap-2">
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
              className={`flex shrink-0 items-center gap-2 rounded-[10px] border px-3 py-2 text-xs font-semibold transition-colors ${
                action.accent
                  ? "border-[#9309ef]/60 bg-[#9309ef]/15 text-white hover:bg-[#9309ef]/25"
                  : "border-[#333] bg-[#232328] text-[#d4d4d8] hover:border-[#555] hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="hidden md:inline">{action.label}</span>
              {badge !== null && badge > 0 && (
                <span className="rounded-full bg-[#0f0f12] px-1.5 py-0.5 text-[10px] font-bold text-[#a1a1aa]">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

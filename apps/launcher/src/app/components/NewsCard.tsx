import { Newspaper } from "lucide-react";
import type { NewsItem } from "@paranoia/contracts";

type NewsCardProps = {
  news: NewsItem[];
};

/**
 * Encart d'actualites, entre la barre du haut et les instances.
 *
 * <p>Il est branche sur {@code /v1/news}, deja appele a chaque demarrage et
 * dont le resultat n'allait nulle part. Tant que le flux ne renvoie rien,
 * l'encart le dit: un cadre vide sans explication ressemble a un defaut
 * d'affichage.
 */
export function NewsCard({ news }: NewsCardProps) {
  const latest = news[0];

  return (
    <div className="mt-6 flex h-[168px] w-[240px] shrink-0 flex-col overflow-hidden rounded-[18px] border border-[#2e2e33] bg-gradient-to-br from-[#221733] via-[#1a1a1f] to-[#131316] p-4">
      <div className="flex items-center gap-2">
        <Newspaper className="h-3.5 w-3.5 shrink-0 text-accent-purple" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-accent-purple">
          Actualites
        </span>
      </div>

      {latest ? (
        <div className="mt-3 min-h-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug text-white">
            {latest.title}
          </p>
          <p className="mt-1.5 line-clamp-4 text-[11px] leading-snug text-[#a1a1aa]">
            {latest.excerpt}
          </p>
        </div>
      ) : (
        <div className="mt-3 flex flex-1 flex-col justify-center">
          <p className="text-sm font-semibold text-white">Rien a annoncer</p>
          <p className="mt-1 text-[11px] leading-snug text-[#71717a]">
            Les annonces du serveur s'afficheront ici.
          </p>
        </div>
      )}
    </div>
  );
}

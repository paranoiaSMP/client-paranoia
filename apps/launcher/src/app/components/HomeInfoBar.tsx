import type { NewsItem, ServerStatus } from "@paranoia/contracts";

type HomeInfoBarProps = {
  status: ServerStatus | null;
  news: NewsItem[];
};

/**
 * Bandeau d'informations en haut de l'accueil.
 *
 * <p>Il occupe la place d'un rectangle gris vide. Les deux sources qu'il
 * affiche existaient deja et n'allaient nulle part: les actualites etaient
 * telechargees a chaque demarrage sans jamais etre rendues, et
 * {@code /v1/server-status} n'etait meme pas appele.
 *
 * <p>Aucune des deux n'est indispensable au lancement du jeu: quand elles
 * manquent, le bandeau se contente de moins, il ne disparait pas et n'affiche
 * pas d'erreur.
 */
export function HomeInfoBar({ status, news }: HomeInfoBarProps) {
  const latest = news[0];

  return (
    <div className="h-[99px] w-full lg:w-[75%] shrink-0 overflow-hidden rounded-[20px] border border-[#2e2e33] bg-gradient-to-r from-[#241536] via-[#1d1d22] to-[#202024] flex items-stretch">
      {/* Etat du serveur */}
      <div className="flex flex-col justify-center gap-1.5 px-5 py-3 min-w-[210px]">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              status?.online ? "bg-emerald-400" : "bg-[#52525b]"
            }`}
          />
          <span className="text-[11px] font-bold uppercase tracking-wider text-white">
            {status === null
              ? "Serveur"
              : status.online
                ? "En ligne"
                : "Hors ligne"}
          </span>
        </div>

        {status?.online ? (
          <>
            <p className="text-sm font-semibold text-white leading-tight">
              {status.playerCount}
              <span className="text-[#a1a1aa] font-normal">
                {" / "}
                {status.maxPlayers} joueurs
              </span>
            </p>
            <p className="text-[11px] text-[#71717a] truncate">
              {status.pingMs} ms &middot; {status.motd}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-[#71717a]">
            {status === null
              ? "Etat indisponible"
              : "Personne ne peut se connecter pour l'instant"}
          </p>
        )}
      </div>

      <div className="w-px my-4 bg-[#2e2e33]" />

      {/* Derniere actualite */}
      <div className="flex flex-1 flex-col justify-center gap-1 px-5 py-3 min-w-0">
        {latest ? (
          <>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-accent-purple shrink-0">
                Actualite
              </span>
              {latest.tags[0] && (
                <span className="text-[10px] text-[#71717a] truncate">
                  {latest.tags[0]}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-white truncate">
              {latest.title}
            </p>
            <p className="text-[11px] text-[#a1a1aa] line-clamp-2 leading-snug">
              {latest.excerpt}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-[#71717a]">Aucune actualite</p>
        )}
      </div>
    </div>
  );
}

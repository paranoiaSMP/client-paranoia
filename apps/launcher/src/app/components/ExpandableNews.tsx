import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Maximize2, Search, X, Calendar, Tag, ArrowRight } from "lucide-react";
import { useOutsideClick } from "../hooks/use-outside-click";
import type { NewsItem } from "@paranoia/contracts";

type ExpandableNewsProps = {
  news: NewsItem[];
  isOpenInFull?: boolean;
  onCloseFull?: () => void;
  onOpenFull?: () => void;
};

export function ExpandableNews({
  news,
  isOpenInFull = false,
  onCloseFull,
  onOpenFull,
}: ExpandableNewsProps) {
  const [active, setActive] = useState<NewsItem | null>(null);
  const [internalFullView, setInternalFullView] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string>("all");

  const isFullView = isOpenInFull || internalFullView;
  const id = useId();
  const cardRef = useRef<HTMLDivElement>(null);

  // Close active card on Escape
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (active) {
          setActive(null);
        } else if (isFullView) {
          handleCloseFull();
        }
      }
    }

    if (active || isFullView) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active, isFullView]);

  useOutsideClick(cardRef as any, () => {
    if (active) setActive(null);
  });

  const handleOpenFull = () => {
    if (onOpenFull) {
      onOpenFull();
    } else {
      setInternalFullView(true);
    }
  };

  const handleCloseFull = () => {
    if (onCloseFull) {
      onCloseFull();
    } else {
      setInternalFullView(false);
    }
    setActive(null);
  };

  // Collect all unique tags for filtering in full view
  const allTags = useMemo(() => {
    const tagsSet = new Set<string>();
    for (const item of news) {
      if (item.tags) {
        for (const tag of item.tags) {
          if (tag) tagsSet.add(tag);
        }
      }
    }
    return Array.from(tagsSet);
  }, [news]);

  // Filtered news for the full grid view
  const filteredNews = useMemo(() => {
    return news.filter((item) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.excerpt.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesTag =
        selectedTag === "all" ||
        (item.tags && item.tags.includes(selectedTag));

      return matchesSearch && matchesTag;
    });
  }, [news, searchQuery, selectedTag]);

  return (
    <>
      {/* 1. EXPANDED SINGLE ARTICLE MODAL (Aceternity Pop-out view) */}
      <AnimatePresence>
        {active && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 md:p-10">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/70 backdrop-blur-md"
              onClick={() => setActive(null)}
            />

            <motion.div
              layoutId={`card-${active.id}-${id}`}
              ref={cardRef}
              className="relative z-10 w-full max-w-3xl flex flex-col bg-surface border border-divider rounded-2xl overflow-hidden shadow-2xl max-h-[90vh]"
            >
              {/* Image banner */}
              <div className="relative shrink-0">
                <motion.div layoutId={`image-${active.id}-${id}`}>
                  {active.imageUrl ? (
                    <img
                      src={active.imageUrl}
                      alt=""
                      className="w-full h-52 sm:h-64 object-cover"
                    />
                  ) : (
                    <div className="w-full h-52 sm:h-64 bg-gradient-to-br from-accent-900 to-ground" />
                  )}
                </motion.div>

                <button
                  type="button"
                  onClick={() => setActive(null)}
                  className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full bg-black/60 text-white hover:bg-black/90 transition-colors z-20 border border-white/10"
                  aria-label="Fermer l'article"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content body */}
              <div className="flex flex-col p-6 overflow-y-auto">
                <div className="flex flex-col gap-2.5 mb-6 border-b border-divider pb-4">
                  <div className="flex flex-wrap items-center gap-2">
                    {active.tags?.map((t) => (
                      <motion.span
                        key={t}
                        layoutId={`tag-${active.id}-${t}-${id}`}
                        className="rounded-md bg-accent-900/60 border border-accent-700/50 px-2.5 py-0.5 text-[11px] text-accent-300 font-semibold uppercase tracking-wider"
                      >
                        {t}
                      </motion.span>
                    ))}
                  </div>

                  <motion.h3
                    layoutId={`title-${active.id}-${id}`}
                    className="text-2xl font-bold text-ink"
                  >
                    {active.title}
                  </motion.h3>

                  <motion.div
                    layoutId={`date-${active.id}-${id}`}
                    className="flex items-center gap-2 text-xs text-neutral-400"
                  >
                    <Calendar className="w-3.5 h-3.5 text-accent" />
                    <span>{formatDate(active.publishedAt)}</span>
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: 0.1 }}
                  className="text-neutral-200 text-sm leading-relaxed max-w-none space-y-4
                    [&>p]:text-neutral-300 [&>p]:leading-relaxed [&>p]:mb-4
                    [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-ink [&>h1]:mt-6 [&>h1]:mb-3
                    [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-ink [&>h2]:mt-5 [&>h2]:mb-2.5
                    [&>h3]:text-lg [&>h3]:font-bold [&>h3]:text-ink [&>h3]:mt-4 [&>h3]:mb-2
                    [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-4 [&>ul]:space-y-1
                    [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:mb-4 [&>ol]:space-y-1
                    [&>li]:text-neutral-300
                    [&>a]:text-accent [&>a]:underline hover:[&>a]:text-accent-300
                    [&>blockquote]:border-l-4 [&>blockquote]:border-accent [&>blockquote]:pl-4 [&>blockquote]:italic [&>blockquote]:text-neutral-400
                    [&>img]:rounded-xl [&>img]:max-w-full [&>img]:my-4 [&>img]:border [&>img]:border-divider"
                  dangerouslySetInnerHTML={{
                    __html: active.contentHtml || active.excerpt,
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. FULL GRID MODAL (Aceternity Expandable Card Grid in full screen) */}
      <AnimatePresence>
        {isFullView && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/75 backdrop-blur-md"
              onClick={handleCloseFull}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              className="relative z-10 w-full max-w-6xl max-h-[90vh] bg-ground border border-divider rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Full Grid Header */}
              <div className="p-6 border-b border-divider bg-surface flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-ink flex items-center gap-2">
                      <span>Toutes les actualités du client</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent font-semibold">
                        {news.length}
                      </span>
                    </h2>
                    <p className="text-neutral-400 text-xs sm:text-sm mt-0.5">
                      Découvrez toutes les annonces, notes de version et nouveautés.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseFull}
                    className="p-2 rounded-lg border border-divider hover:border-neutral-600 hover:bg-well text-neutral-400 hover:text-ink transition-colors"
                    aria-label="Fermer la vue complète"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Search & Tag Filter Bar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                  {/* Search input */}
                  <div className="flex items-center bg-ground border border-divider rounded-xl px-3.5 py-2 flex-1 max-w-md">
                    <Search className="w-4 h-4 text-neutral-500 mr-2 shrink-0" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Rechercher une actualité..."
                      className="bg-transparent border-none outline-none text-xs sm:text-sm text-ink w-full placeholder:text-neutral-500"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="text-neutral-500 hover:text-ink text-xs"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Tag filters */}
                  {allTags.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto py-1">
                      <button
                        type="button"
                        onClick={() => setSelectedTag("all")}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                          selectedTag === "all"
                            ? "bg-accent text-accent-100"
                            : "bg-surface border border-divider text-neutral-400 hover:text-ink hover:bg-well"
                        }`}
                      >
                        Toutes
                      </button>
                      {allTags.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSelectedTag(t)}
                          className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                            selectedTag === t
                              ? "bg-accent text-accent-100"
                              : "bg-surface border border-divider text-neutral-400 hover:text-ink hover:bg-well"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Grid of All Cards */}
              <div className="p-6 overflow-y-auto flex-1">
                {filteredNews.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <p className="text-neutral-400 text-sm">
                      Aucune actualité ne correspond à votre recherche.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSelectedTag("all");
                      }}
                      className="mt-3 text-xs text-accent hover:underline font-semibold"
                    >
                      Réinitialiser les filtres
                    </button>
                  </div>
                ) : (
                  <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredNews.map((item) => (
                      <motion.li
                        layoutId={`card-${item.id}-${id}`}
                        key={item.id}
                        onClick={() => setActive(item)}
                        className="group flex flex-col cursor-pointer overflow-hidden rounded-xl bg-surface border border-divider transition-all hover:border-accent hover:shadow-xl hover:-translate-y-0.5"
                      >
                        <motion.div
                          layoutId={`image-${item.id}-${id}`}
                          className="h-44 bg-gradient-to-br from-accent-900 to-neutral-900 relative overflow-hidden"
                        >
                          {item.imageUrl ? (
                            <img
                              alt=""
                              src={item.imageUrl}
                              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                              loading="lazy"
                            />
                          ) : (
                            <div className="size-full flex items-center justify-center bg-gradient-to-br from-accent-900/60 to-ground">
                              <span className="text-2xl font-bold text-accent-300 opacity-40">
                                Paranoia
                              </span>
                            </div>
                          )}
                        </motion.div>

                        <div className="flex flex-1 flex-col gap-2.5 p-5">
                          {item.tags?.[0] && (
                            <motion.span
                              layoutId={`tag-${item.id}-${item.tags[0]}-${id}`}
                              className="self-start rounded-md bg-accent-900/50 border border-accent-700/40 px-2 py-0.5 text-[10px] text-accent-300 font-semibold uppercase tracking-wider"
                            >
                              {item.tags[0]}
                            </motion.span>
                          )}

                          <motion.h3
                            layoutId={`title-${item.id}-${id}`}
                            className="m-0 text-base font-semibold leading-snug text-ink line-clamp-2 group-hover:text-accent-300 transition-colors"
                          >
                            {item.title}
                          </motion.h3>

                          <motion.p
                            initial={{ opacity: 1 }}
                            className="m-0 flex-1 text-xs text-neutral-400 line-clamp-3 leading-relaxed"
                          >
                            {item.excerpt}
                          </motion.p>

                          <div className="flex items-center justify-between pt-3 border-t border-divider mt-2 text-xs">
                            <motion.span
                              layoutId={`date-${item.id}-${id}`}
                              className="text-neutral-500 font-medium"
                            >
                              {formatDate(item.publishedAt)}
                            </motion.span>
                            <span className="flex items-center gap-1 text-accent font-semibold group-hover:translate-x-0.5 transition-transform">
                              Lire
                              <ArrowRight className="w-3.5 h-3.5" />
                            </span>
                          </div>
                        </div>
                      </motion.li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. DEFAULT COMPACT HOME GRID (Shows top 3 cards + "Voir en grand" CTA) */}
      <div className="flex flex-col gap-3">
        <ul className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
          {news.slice(0, 3).map((item) => (
            <motion.li
              layoutId={`card-${item.id}-${id}`}
              key={item.id}
              onClick={() => setActive(item)}
              className="flex flex-col cursor-pointer overflow-hidden rounded-xl bg-surface border border-divider transition-all hover:border-accent hover:shadow-[0_0_15px_-5px_var(--color-accent)]"
            >
              <motion.div
                layoutId={`image-${item.id}-${id}`}
                className="h-[120px] bg-gradient-to-br from-accent-900 to-neutral-900 relative"
              >
                {item.imageUrl ? (
                  <img
                    alt=""
                    src={item.imageUrl}
                    className="size-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="size-full flex items-center justify-center bg-gradient-to-br from-accent-900/60 to-ground">
                    <span className="text-xl font-bold text-accent-300 opacity-40">
                      Paranoia
                    </span>
                  </div>
                )}
              </motion.div>

              <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
                {item.tags?.[0] && (
                  <motion.span
                    layoutId={`tag-${item.id}-${item.tags[0]}-${id}`}
                    className="self-start rounded-md bg-accent-900/50 border border-accent-700/40 px-2 py-0.5 text-[10.5px] text-accent-300 font-semibold"
                  >
                    {item.tags[0]}
                  </motion.span>
                )}

                <motion.h3
                  layoutId={`title-${item.id}-${id}`}
                  className="m-0 text-[15px] font-semibold leading-tight text-ink"
                >
                  {item.title}
                </motion.h3>

                <motion.p
                  initial={{ opacity: 1 }}
                  className="m-0 flex-1 text-[13px] text-neutral-300 line-clamp-3 leading-relaxed"
                >
                  {item.excerpt}
                </motion.p>

                <div className="flex items-center justify-between mt-1 pt-2 border-t border-divider/40">
                  <motion.span
                    layoutId={`date-${item.id}-${id}`}
                    className="text-[12px] text-neutral-400"
                  >
                    {formatDate(item.publishedAt)}
                  </motion.span>
                  <span className="text-xs text-accent font-semibold flex items-center gap-1">
                    Lire <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            </motion.li>
          ))}
        </ul>

        {news.length > 3 && (
          <div className="flex justify-end mt-1">
            <button
              type="button"
              onClick={handleOpenFull}
              className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-300 hover:underline transition-colors"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Afficher toutes les actualités ({news.length})</span>
            </button>
          </div>
        )}
      </div>
    </>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

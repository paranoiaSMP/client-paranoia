import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useOutsideClick } from "../hooks/use-outside-click";
import type { NewsItem } from "@paranoia/contracts";

export function ExpandableNews({ news }: { news: NewsItem[] }) {
  const [active, setActive] = useState<NewsItem | boolean | null>(null);
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActive(false);
      }
    }

    if (active && typeof active === "object") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  useOutsideClick(ref as any, () => setActive(false));

  return (
    <>
      <AnimatePresence>
        {active && typeof active === "object" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 md:p-10"
          >
            <motion.div
              layoutId={`card-${active.id}-${id}`}
              ref={ref}
              className="w-full max-w-3xl flex flex-col bg-surface border border-divider rounded-[20px] overflow-hidden shadow-2xl max-h-[90vh]"
            >
              <div className="relative">
                <motion.div layoutId={`image-${active.id}-${id}`}>
                  {active.imageUrl ? (
                    <img
                      src={active.imageUrl}
                      alt=""
                      className="w-full h-48 sm:h-64 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 sm:h-64 bg-gradient-to-br from-accent-900 to-neutral-900" />
                  )}
                </motion.div>
                
                <button
                  type="button"
                  onClick={() => setActive(null)}
                  className="absolute top-4 right-4 flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors z-10"
                >
                  <CloseIcon />
                </button>
              </div>

              <div className="flex flex-col p-6 overflow-y-auto">
                <div className="flex flex-col gap-2 mb-6">
                  {active.tags?.[0] && (
                    <motion.span 
                      layoutId={`tag-${active.id}-${id}`}
                      className="self-start rounded-[6px] bg-accent-800 px-2.5 py-0.5 text-[11px] text-accent-100 uppercase tracking-wider font-semibold"
                    >
                      {active.tags[0]}
                    </motion.span>
                  )}
                  <motion.h3
                    layoutId={`title-${active.id}-${id}`}
                    className="text-2xl font-bold text-ink"
                  >
                    {active.title}
                  </motion.h3>
                  
                  <motion.div 
                    layoutId={`date-${active.id}-${id}`}
                    className="text-sm text-neutral-400"
                  >
                    {formatDate(active.publishedAt)}
                  </motion.div>
                </div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ delay: 0.1 }}
                  className="text-neutral-300 text-sm leading-relaxed max-w-none [&>p]:mb-4 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:text-ink [&>h1]:mb-4 [&>h2]:text-xl [&>h2]:font-bold [&>h2]:text-ink [&>h2]:mb-3 [&>h3]:text-lg [&>h3]:font-bold [&>h3]:text-ink [&>h3]:mb-2 [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-4 [&>a]:text-accent-400 hover:[&>a]:text-accent-300 [&>a]:underline"
                  dangerouslySetInnerHTML={{ __html: active.contentHtml || active.excerpt }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ul className="grid grid-cols-[repeat(auto-fit,minmax(230px,1fr))] gap-4">
        {news.slice(0, 3).map((item) => (
          <motion.li
            layoutId={`card-${item.id}-${id}`}
            key={item.id}
            onClick={() => setActive(item)}
            className="flex flex-col cursor-pointer overflow-hidden rounded-md bg-surface border border-transparent transition-colors hover:border-accent-700 hover:shadow-[0_0_15px_-5px_var(--color-accent)]"
          >
            <motion.div layoutId={`image-${item.id}-${id}`} className="h-[120px] bg-gradient-to-br from-accent-900 to-neutral-900 relative">
              {item.imageUrl && (
                <img
                  alt=""
                  src={item.imageUrl}
                  className="size-full object-cover"
                />
              )}
            </motion.div>
            
            <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
              {item.tags?.[0] && (
                <motion.span 
                  layoutId={`tag-${item.id}-${id}`}
                  className="self-start rounded-[6px] bg-accent-800 px-2.5 py-0.5 text-[11px] text-accent-100"
                >
                  {item.tags[0]}
                </motion.span>
              )}
              
              <motion.h3
                layoutId={`title-${item.id}-${id}`}
                className="m-0 text-[15.5px] font-medium leading-tight text-ink"
              >
                {item.title}
              </motion.h3>
              
              <motion.p
                initial={{ opacity: 1 }}
                className="m-0 flex-1 text-[13.5px] text-neutral-300 line-clamp-3"
              >
                {item.excerpt}
              </motion.p>
              
              <motion.span 
                layoutId={`date-${item.id}-${id}`}
                className="text-[12.5px] text-neutral-400 mt-1"
              >
                {formatDate(item.publishedAt)}
              </motion.span>
            </div>
          </motion.li>
        ))}
      </ul>
    </>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

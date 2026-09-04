import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { useOutsideClick } from "../hooks/use-outside-click";
import { Newspaper, X } from "lucide-react";
import type { NewsItem } from "@paranoia/contracts";

type NewsCardProps = {
	news: NewsItem[];
};

export function NewsCard({ news }: NewsCardProps) {
	const [active, setActive] = useState<NewsItem | null>(null);
	const id = useId();
	const ref = useRef<HTMLDivElement>(null);

	const latest = news[0];

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setActive(null);
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

	useOutsideClick(ref as any, () => setActive(null));

	return (
		<>
			<AnimatePresence>
				{active && typeof active === "object" && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm h-full w-full z-[100]"
					/>
				)}
			</AnimatePresence>
			<AnimatePresence>
				{active && typeof active === "object" ? (
					<div className="fixed inset-0 grid place-items-center z-[100] p-4 md:p-8">
						<motion.button
							key={`button-${active.title}-${id}`}
							layout
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0, transition: { duration: 0.05 } }}
							className="flex absolute top-4 right-4 items-center justify-center bg-[#241d3c] hover:bg-[#372d58] transition-colors rounded-full h-8 w-8 z-10"
							onClick={() => setActive(null)}
						>
							<X className="w-4 h-4 text-white" />
						</motion.button>

						<motion.div
							layoutId={`card-${active.title}-${id}`}
							ref={ref as any}
							className="w-full max-w-[600px] h-full md:h-fit md:max-h-[90%] flex flex-col bg-[#161225] border border-[#292142] sm:rounded-3xl overflow-hidden shadow-2xl"
						>
							{active.imageUrl && (
								<motion.div layoutId={`image-${active.title}-${id}`}>
									<img
										width={600}
										height={300}
										src={active.imageUrl}
										alt={active.title}
										className="w-full h-64 lg:h-72 sm:rounded-tr-lg sm:rounded-tl-lg object-cover object-top"
									/>
								</motion.div>
							)}

							<div className="flex flex-col flex-1 overflow-hidden">
								<div className="flex justify-between items-start p-6 pb-2">
									<div>
										<motion.h3
											layoutId={`title-${active.title}-${id}`}
											className="font-bold text-white text-xl md:text-2xl"
										>
											{active.title}
										</motion.h3>
										<motion.p
											layoutId={`description-${active.title}-${id}`}
											className="text-[#9a92b6] text-sm mt-1"
										>
											{active.excerpt}
										</motion.p>
									</div>
								</div>

								<div className="p-6 pt-4 relative flex-1 overflow-auto">
									<motion.div
										layout
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										className="text-[#cfc9de] text-sm md:text-base pb-6 flex flex-col items-start gap-4"
										dangerouslySetInnerHTML={{ __html: active.contentHtml }}
									/>
								</div>
							</div>
						</motion.div>
					</div>
				) : null}
			</AnimatePresence>

			<motion.div
				{...(latest ? { layoutId: `card-${latest.title}-${id}` } : {})}
				onClick={() => latest && setActive(latest)}
				className="mt-6 flex h-[168px] w-[240px] shrink-0 flex-col overflow-hidden rounded-[18px] border border-[#292142] bg-gradient-to-br from-[#221733] via-[#1a1a1f] to-[#161225] p-4 cursor-pointer hover:border-accent-purple/50 transition-colors"
			>
				<div className="flex items-center gap-2">
					<Newspaper className="h-3.5 w-3.5 shrink-0 text-accent-purple" />
					<span className="text-[10px] font-bold uppercase tracking-widest text-accent-purple">
						Actualités
					</span>
				</div>

				{latest ? (
					<div className="mt-3 min-h-0 flex-1 flex flex-col">
						<motion.h3
							layoutId={`title-${latest.title}-${id}`}
							className="line-clamp-2 text-sm font-semibold leading-snug text-white"
						>
							{latest.title}
						</motion.h3>
						<motion.p
							layoutId={`description-${latest.title}-${id}`}
							className="mt-1.5 line-clamp-4 text-[11px] leading-snug text-[#9a92b6]"
						>
							{latest.excerpt}
						</motion.p>
					</div>
				) : (
					<div className="mt-3 flex flex-1 flex-col justify-center">
						<p className="text-sm font-semibold text-white">Rien à annoncer</p>
						<p className="mt-1 text-[11px] leading-snug text-[#7a7194]">
							Les annonces du serveur s'afficheront ici.
						</p>
					</div>
				)}
			</motion.div>
		</>
	);
}

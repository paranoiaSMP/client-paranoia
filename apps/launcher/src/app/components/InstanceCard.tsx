/**
 * Gabarit commun aux vignettes d'instance et au bouton d'ajout.
 *
 * <p>Le bouton d'ajout faisait 80 pixels de cote a cote de vignettes de 180:
 * il se lisait comme un bouton egare dans la rangee plutot que comme la case
 * suivante. Les deux partagent desormais la meme taille, et la rangee se lit
 * comme une suite de cases dont la derniere est vide.
 */
export const CARD_SIZE = "h-[144px] w-[112px] xl:h-[172px] xl:w-[140px]";

type InstanceCardProps = {
	label: string;
	version?: string;
	detail?: string;
	isSelected: boolean;
	onClick: () => void;
};

/**
 * Vignette d'instance.
 *
 * <p>Le degrade et la lueur ne sont pas decoratifs seulement: une vignette
 * pleine d'un aplat uni ne se distinguait de sa voisine que par la couleur de
 * sa bordure, difficile a voir de loin. La version selectionnee est violette et
 * eclairee, les autres restent sombres.
 *
 * <p>La version est dans une pastille et non dans la ligne de detail: c'est la
 * seule information qu'on cherche en balayant la rangee -- savoir laquelle est
 * en 1.21.11 -- et une pastille se trouve d'un coup d'oeil la ou une ligne de
 * texte gris demande de lire.
 */
export function InstanceCard({
	label,
	version,
	detail,
	isSelected,
	onClick,
}: InstanceCardProps) {
	return (
		<article
			onClick={onClick}
			className={`group relative flex ${CARD_SIZE} shrink-0 cursor-pointer flex-col justify-end overflow-hidden rounded-[22px] p-3 transition-[box-shadow,border-color] ${
				isSelected ? "bubble-active" : "bubble hover:border-white/15"
			}`}
		>
			{/* Lueur d'angle, derriere le contenu. */}
			<div
				aria-hidden="true"
				className={`pointer-events-none absolute -top-10 -right-10 h-32 w-32 rounded-full blur-2xl transition-opacity ${
					isSelected ? "bg-[#8b5cf6]/40" : "bg-white/5 group-hover:bg-white/10"
				}`}
			/>

			<div className="relative z-10 min-w-0">
				<p className="truncate text-[13px] font-medium leading-normal text-white">
					{label}
				</p>
				{detail && (
					<p className="mt-0.5 truncate text-[11px] text-[#9a92b6]">{detail}</p>
				)}
				{version && (
					<span
						className={`mt-1.5 inline-block max-w-full truncate rounded-[7px] border px-1.5 py-0.5 text-[10px] font-semibold ${
							isSelected
								? "border-[#8b5cf6]/60 bg-[#8b5cf6]/15 text-[#cfa8ff]"
								: "border-white/10 bg-black/30 text-[#9a92b6]"
						}`}
					>
						{version}
					</span>
				)}
			</div>
		</article>
	);
}

/**
 * Le titre d'un ecran.
 *
 * <p>Les sept ecrans ouvrent tous de la meme facon dans la maquette: un titre
 * de vingt-six pixels et une phrase qui dit a quoi sert la page. Ecrit une
 * fois, l'ecart entre le titre et la phrase reste le meme d'un ecran a l'autre
 * -- c'est ce qui donne l'impression de passer d'une page a l'autre plutot que
 * d'ouvrir sept fenetres differentes.
 */
export function ScreenHeader({
	title,
	subtitle,
	children,
}: {
	title: string;
	subtitle: string;
	/** Ce qui se pose a droite du titre: un filtre, une recherche. */
	children?: React.ReactNode;
}) {
	return (
		<header className="flex flex-wrap items-end justify-between gap-4">
			<div className="flex flex-col gap-1.5">
				<h1 className="m-0 text-[26px] font-medium tracking-[-0.01em]">
					{title}
				</h1>
				<p className="m-0 text-sm text-neutral-300">{subtitle}</p>
			</div>
			{children}
		</header>
	);
}

import { daysUntilHalloween } from "../../season";

/*
 * Les decors d'Halloween.
 *
 * Tous decoratifs: aria-hidden, sans pointeur, poses sous le contenu. Ils
 * n'existent que lorsque l'habillage est actif, et leurs animations s'arretent
 * avec prefers-reduced-motion (voir styles.css).
 */

/** Une citrouille sculptee. Le corps prend la couleur courante, le visage s'eclaire. */
export function Pumpkin({ className = "" }: { className?: string }) {
	return (
		<svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
			<path
				d="M16 8.5c-1.2-2.3-.4-4.6 1.6-5.5"
				stroke="var(--color-hw-stem)"
				strokeWidth="2.2"
				strokeLinecap="round"
			/>
			<ellipse cx="10.5" cy="18.5" rx="7.5" ry="9.5" fill="currentColor" />
			<ellipse cx="21.5" cy="18.5" rx="7.5" ry="9.5" fill="currentColor" />
			<ellipse cx="16" cy="18.5" rx="7" ry="10" fill="currentColor" />
			<path
				d="M16 9c-2.6 2.8-2.6 16.2 0 19M16 9c2.6 2.8 2.6 16.2 0 19"
				stroke="rgba(0,0,0,.28)"
				strokeWidth="1"
			/>
			<g className="hw-face" fill="var(--color-hw-glow)">
				<path d="M8.5 16.5l3.2-3.4 1.6 3.4z" />
				<path d="M23.5 16.5l-3.2-3.4-1.6 3.4z" />
				<path d="M8 20.5c2.2 3.6 13.8 3.6 16 0l-2 .6-1 1.6-1.4-1.3-1.6 1.6-2-1.6-1.8 1.6-1.6-1.6-1.4 1.3-1-1.6z" />
			</g>
		</svg>
	);
}

function Bat({ className, style }: { className: string; style?: React.CSSProperties }) {
	return (
		<span className={`hw-bat ${className}`} style={style}>
			<svg viewBox="0 0 64 28" className="hw-bat-body" fill="currentColor">
				<path d="M32 9c1.4-2.6 2-3.6 2.6-5 .5 1.6.6 3 .4 4.6 4.6-.8 8.6-3 11.4-7.6 1 5 4.6 8.4 9.6 8.6 3 .2 5.6-1 8-3-1.6 6.8-6.4 11-12.8 11.4-2.8.2-5.2 1.4-6.4 4.4-2-2.4-5-3.6-8.8-3.4l-4 7.2-4-7.2c-3.8-.2-6.8 1-8.8 3.4-1.2-3-3.6-4.2-6.4-4.4C6.4 17.6 1.6 13.4 0 6.6c2.4 2 5 3.2 8 3 5-.2 8.6-3.6 9.6-8.6 2.8 4.6 6.8 6.8 11.4 7.6-.2-1.6-.1-3 .4-4.6.6 1.4 1.2 2.4 2.6 5z" />
			</svg>
		</span>
	);
}

/**
 * Le ciel de l'accueil: lune, chauves-souris et brume.
 *
 * <p>Pose en fond du bandeau de profil, dont il prend toute la surface. La
 * brume reste dans le tiers bas et a faible opacite: le texte d'etat du
 * lancement est juste au-dessus, et il doit rester lisible.
 */
export function HalloweenSky() {
	return (
		<div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
			<div className="hw-moon absolute right-[150px] top-[-40px] size-[230px] rounded-full" />
			<Bat className="hw-bat-a" />
			<Bat className="hw-bat-b" />
			<Bat className="hw-bat-c" />
			<div className="hw-fog hw-fog-a" />
			<div className="hw-fog hw-fog-b" />
		</div>
	);
}

/** La toile du coin de la barre laterale, et son habitante. */
export function Cobweb() {
	const rays = [0, 18, 36, 54, 72, 90];
	const rings = [22, 40, 58, 76];
	return (
		<div aria-hidden className="pointer-events-none absolute right-0 top-0 size-[96px]">
			<svg viewBox="0 0 96 96" className="size-full text-neutral-600" fill="none">
				{rays.map((deg) => {
					const r = (deg * Math.PI) / 180;
					return (
						<line
							key={deg}
							x1="96"
							y1="0"
							x2={96 - Math.cos(r) * 96}
							y2={Math.sin(r) * 96}
							stroke="currentColor"
							strokeWidth=".7"
							opacity=".55"
						/>
					);
				})}
				{rings.map((radius) => {
					const pts = rays.map((deg): [number, number] => {
						const r = (deg * Math.PI) / 180;
						return [96 - Math.cos(r) * radius, Math.sin(r) * radius];
					});
					const d = pts
						.map(([x, y], i) => {
							if (i === 0) return `M${x} ${y}`;
							const [px, py] = pts[i - 1] ?? [x, y];
							// La soie pend: chaque segment se creuse vers le coin.
							const cx = (px + x) / 2 + 3;
							const cy = (py + y) / 2 - 3;
							return `Q${cx} ${cy} ${x} ${y}`;
						})
						.join(" ");
					return (
						<path key={radius} d={d} stroke="currentColor" strokeWidth=".7" opacity=".5" />
					);
				})}
			</svg>
			<div className="hw-spider absolute right-[30px] top-0 flex flex-col items-center">
				<span className="h-[18px] w-px bg-neutral-600/70" />
				<svg viewBox="0 0 20 16" className="w-[16px] text-neutral-400" fill="none">
					<g stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
						<path d="M7 7L2 3M7 8.5L1 8M7 10L2 14M13 7l5-4M13 8.5l6-.5M13 10l5 4" />
					</g>
					<ellipse cx="10" cy="9" rx="3.4" ry="4" fill="currentColor" />
					<circle cx="8.8" cy="7.6" r=".7" fill="var(--color-accent-400)" />
					<circle cx="11.2" cy="7.6" r=".7" fill="var(--color-accent-400)" />
				</svg>
			</div>
		</div>
	);
}

/** « Halloween dans 14 jours », « C'est ce soir », ou rien une fois passe. */
export function HalloweenCountdown() {
	const days = daysUntilHalloween();
	if (days === null) return null;

	const label =
		days === 0 ? "C'est ce soir" : days === 1 ? "Demain soir" : `Dans ${days} jours`;

	return (
		<span className="inline-flex items-center gap-1.5 rounded-sm border border-accent-800 bg-accent-900/70 py-0.5 pl-1 pr-2 text-[11px] font-medium normal-case tracking-normal text-accent-200">
			<Pumpkin className="size-4 text-accent" />
			Halloween · {label}
		</span>
	);
}

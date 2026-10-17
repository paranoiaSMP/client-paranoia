/**
 * Les décorations de saison, dessinées plutôt qu'importées.
 *
 * <p>Du SVG écrit à la main et non des images: le trait prend la couleur du
 * thème au lieu de la figer dans un fichier, il reste net sur un écran à haute
 * densité, et le launcher n'embarque pas trois PNG de plus pour trois semaines
 * d'octobre.
 *
 * <p>Toutes portent {@code decor-saison}: c'est la feuille de style qui décide
 * de les montrer, selon l'attribut de thème du document. Aucune n'a donc besoin
 * de savoir quel thème est en cours, et aucune prop ne traverse la coquille
 * pour leur dire.
 *
 * <p>Toutes sont également {@code aria-hidden} et sans événements: elles sont
 * là pour l'oeil, elles n'ont rien à dire à un lecteur d'écran et ne doivent
 * jamais intercepter un clic destiné à ce qu'elles recouvrent.
 */

/**
 * Une toile d'araignée accrochée à un coin.
 *
 * <p>Les coordonnées sont calculées et non saisies: une toile, ce sont des
 * rayons à angles réguliers et des fils qui pendent entre eux. L'écrire ainsi
 * laisse le dessin relisible — on change le nombre d'anneaux sur une ligne — là
 * où quarante paires de nombres n'auraient plus rien voulu dire.
 */
const RAYONS = [34, 62, 92, 124];
const ANGLES = [0, 22.5, 45, 67.5, 90];

/** Le point du rayon {@code angle} à la distance {@code r}, coin à l'origine. */
function point(r: number, angle: number): [number, number] {
  const rad = (angle * Math.PI) / 180;
  return [r * Math.cos(rad), r * Math.sin(rad)];
}

/**
 * Les fils qui pendent entre deux rayons.
 *
 * <p>Une courbe et non un segment: un fil de toile s'affaisse vers le centre,
 * et c'est ce creux qui fait lire « toile » plutôt que « éventail ». Le point
 * de contrôle est posé sur la bissectrice, à 86 % du rayon.
 */
function fils(r: number): string {
  const parts: string[] = [];
  for (let i = 0; i < ANGLES.length - 1; i++) {
    const depart = ANGLES[i]!;
    const arrivee = ANGLES[i + 1]!;
    const [x1, y1] = point(r, depart);
    const [x2, y2] = point(r, arrivee);
    const [cx, cy] = point(r * 0.86, (depart + arrivee) / 2);
    parts.push(`M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}`);
  }
  return parts.join(" ");
}

export function ToileDAraignee({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={`decor-saison pointer-events-none absolute ${className}`}
      viewBox="0 0 130 130"
      fill="none"
    >
      <g
        stroke="currentColor"
        strokeWidth={1}
        strokeLinecap="round"
        opacity={0.4}
      >
        {ANGLES.map((angle) => {
          const [x, y] = point(RAYONS[RAYONS.length - 1]!, angle);
          return <path key={angle} d={`M0 0 L${x} ${y}`} />;
        })}
        {RAYONS.map((r) => (
          <path key={r} d={fils(r)} />
        ))}
      </g>
    </svg>
  );
}

/**
 * Le bord d'attaque et les trois festons d'une aile, côté droit.
 *
 * <p>Écrit une fois et posé deux fois, la seconde à travers une symétrie: une
 * chauve-souris dissymétrique se remarque immédiatement, et deux chemins
 * recopiés auraient fini par diverger à la première retouche.
 */
const AILE =
  "M34.2 9.4C41.6 3.4 51 .6 61.4 2.6c-.9 5.4-3.6 10.2-8.2 14.4-1.9-3.6-2.7-6.6-2.4-9-2.5 5-5.6 8.6-9.2 11-1.2-3.6-1.6-6.7-1.3-9.3-2.2 4-4.3 6.7-6.1 8.1Z";

/**
 * Une chauve-souris, de face, ailes déployées.
 *
 * <p>Une silhouette pleine sans contour: à cette taille, un trait doublerait la
 * surface du dessin et le transformerait en tache.
 */
function ChauveSouris({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      aria-hidden
      className={`chauve-souris pointer-events-none absolute ${className}`}
      viewBox="0 0 64 24"
      fill="currentColor"
    >
      {/* Corps, et les deux oreilles qui le coiffent. */}
      <path d="M32 7c1.8 0 3 1.5 3 3.6 0 2.7-1.2 5.5-3 7.7-1.8-2.2-3-5-3-7.7C29 8.5 30.2 7 32 7Z" />
      <path d="M29.9 8.1 27.6 2.4l3.5 3ZM34.1 8.1l2.3-5.7-3.5 3Z" />
      {/* Aile droite. Les festons sont profonds — ils remontent presque jusqu'au
          bord d'attaque — et c'est ce qui fait tout: avec des entailles peu
          marquées, la silhouette se lit comme un papillon de nuit. */}
      <path d={AILE} />
      {/* Aile gauche: le miroir exact de la droite, autour de l'axe x = 32. */}
      <path d={AILE} transform="matrix(-1 0 0 1 64 0)" />
    </svg>
  );
}

/**
 * La lune et ses chauves-souris, derrière l'en-tête de l'accueil.
 *
 * <p>Posée à droite, là où l'en-tête est vide: elle remplit un angle mort au
 * lieu de passer derrière le titre, qu'elle rendrait plus difficile à lire pour
 * ne rien gagner.
 *
 * <p>La lueur est un dégradé radial et non une ombre portée: une ombre aurait
 * suivi le disque, alors que ce qu'on veut est une clarté diffuse qui déborde
 * largement autour de lui.
 */
export function LuneEtChauvesSouris() {
  return (
    <div
      aria-hidden
      className="decor-saison pointer-events-none absolute inset-y-0 right-0 w-[620px] overflow-hidden"
    >
      {/*
        Décalée de 272 pixels du bord droit, et ce n'est pas un réglage à l'oeil:
        c'est exactement la place que prend le panneau du skin — 248 de large,
        plus les 24 de marge de la section. Posée plus à droite, la lune
        disparaissait entièrement derrière lui.

        Elle en effleure tout de même le bord, et c'est voulu: une lune qui passe
        derrière un panneau donne une profondeur qu'une lune posée à côté n'a
        pas.
      */}
      <div
        className="absolute right-[238px] top-0 size-[236px] rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(circle, var(--color-accent-400) 0%, color-mix(in srgb, var(--color-accent-600) 55%, transparent) 38%, transparent 70%)",
        }}
      />
      <div className="absolute right-[286px] top-[40px] size-[132px] rounded-full bg-accent-300 opacity-85 shadow-[0_0_44px_2px_color-mix(in_srgb,var(--color-accent-500)_70%,transparent)]">
        {/* Les cratères: le même orange que le fond du disque, assombri. Un gris
            les aurait fait lire comme des trous plutôt que comme du relief. */}
        <span className="absolute left-[26px] top-[34px] size-[26px] rounded-full bg-accent-400 opacity-60" />
        <span className="absolute left-[72px] top-[22px] size-[16px] rounded-full bg-accent-400 opacity-50" />
        <span className="absolute left-[54px] top-[82px] size-[20px] rounded-full bg-accent-400 opacity-45" />
      </div>

      {/* Devant la lune, donc en silhouette: c'est ce contre-jour qui rend la
          forme lisible. Les retards désynchronisent la dérive — trois
          chauves-souris qui battent à l'unisson font un logo, pas un vol. */}
      <ChauveSouris
        className="right-[262px] top-[28px] w-[52px] text-ground"
        style={{ animationDelay: "0s" }}
      />
      <ChauveSouris
        className="right-[392px] top-[96px] w-[36px] text-ground opacity-90"
        style={{ animationDelay: "-7s" }}
      />
      <ChauveSouris
        className="right-[330px] top-[158px] w-[26px] text-ground opacity-70"
        style={{ animationDelay: "-13s" }}
      />
    </div>
  );
}

/**
 * Une citrouille, pour la barre de titre.
 *
 * <p>Elle remplace l'icône qu'aucune bibliothèque ne fournit — ni lucide ni les
 * autres n'ont de citrouille — et c'est tant mieux: celle-ci porte les couleurs
 * du thème au lieu d'un orange figé qui jurerait le jour où la gamme bouge.
 */
export function Citrouille({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={`decor-saison pointer-events-none ${className}`}
      viewBox="0 0 32 32"
      fill="none"
    >
      {/* La queue, avant le corps: elle doit passer dessous. */}
      <path
        d="M16 9c0-3 .6-5.2 2.6-6.4"
        stroke="var(--color-accent-700)"
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      {/* Trois lobes, du plus lointain au plus proche. Les deux côtés sont plus
          sombres: c'est ce qui donne le volume sans dessiner une seule ombre. */}
      <ellipse cx="10.5" cy="19.5" rx="7.5" ry="9.5" fill="var(--color-accent-600)" />
      <ellipse cx="21.5" cy="19.5" rx="7.5" ry="9.5" fill="var(--color-accent-600)" />
      <ellipse cx="16" cy="19.5" rx="9" ry="9.5" fill="var(--color-accent-400)" />
      {/* Les yeux et la bouche, évidés dans la couleur du fond de la barre. */}
      <path
        d="M12.6 16.4 9.5 20.2h5.2ZM19.4 16.4l3.1 3.8h-5.2Z"
        fill="var(--color-ground)"
      />
      <path
        d="M10.6 23.1h10.8c-.7 2.2-2.6 3.5-5.4 3.5s-4.7-1.3-5.4-3.5Z"
        fill="var(--color-ground)"
      />
      <path
        d="M13.4 23.1v1.9h1.4v-1.9Zm3.8 0v1.9h1.4v-1.9Z"
        fill="var(--color-accent-400)"
      />
    </svg>
  );
}

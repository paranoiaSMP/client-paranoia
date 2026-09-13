import type { CSSProperties } from "react";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
	Box,
	LogOut,
	Menu,
	Pickaxe,
	Play,
	Settings,
	Terminal,
	User,
	X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, useReducedMotion } from "motion/react";
import type {
	LauncherProfile,
	MicrosoftAccount,
	NewsItem,
} from "@paranoia/contracts";

import { SkinViewer3D } from "../../components/SkinViewer3D";
import { HomeActionBar } from "./HomeActionBar";
import { NewsCard } from "./NewsCard";
import { CARD_SIZE, InstanceCard } from "./InstanceCard";

/**
 * Les ecrans que l'accueil peut ouvrir par-dessus lui.
 *
 * <p>C'etait une union anonyme ecrite dans l'appel a {@code useState}: rien ne
 * pouvait s'y referer, et le menu deroulant reproduisait donc les memes noms a
 * la main sans qu'aucun controle ne les relie.
 */
export type ActiveModal =
	| "none"
	| "profils"
	| "create_profile"
	| "migrate_profile"
	| "mods"
	| "parametres"
	| "logs"
	| "instance"
	| "cosmetiques"
	| "boutique"
	| "comptes";

/**
 * Le menu deroulant du coin.
 *
 * <p>Ses cinq boutons etaient ecrits cinq fois, avec la meme centaine de
 * caracteres de classes recopiee a l'identique. En ajouter un sixieme
 * demandait de recopier une sixieme fois, et corriger un espacement demandait
 * cinq modifications dont on pouvait en oublier une.
 */
const MENU_ITEMS: { modal: ActiveModal; icon: LucideIcon; title: string }[] = [
	{ modal: "comptes", icon: User, title: "Comptes" },
	{ modal: "profils", icon: Box, title: "Gérer les profils" },
	{ modal: "mods", icon: Pickaxe, title: "Mods" },
	{ modal: "parametres", icon: Settings, title: "Paramètres" },
	{ modal: "logs", icon: Terminal, title: "Logs de jeu" },
];

const MENU_BUTTON =
	"w-10 h-10 flex items-center justify-center rounded-[10px] hover:bg-[#2c2447] transition-colors group relative";

type HomeScreenProps = {
	background: CSSProperties;
	news: NewsItem[];
	profiles: LauncherProfile[];
	mainProfile: LauncherProfile | null;
	modCount: number | null;
	account: MicrosoftAccount | null;
	lobbyCape: string | undefined;
	/** Un lancement est en cours: le bouton devient « Arreter ». */
	running: boolean;
	/** Part du telechargement effectuee, de 0 a 1. */
	progress: number;
	onOpen: (modal: ActiveModal) => void;
	onSelectProfile: (profileId: string) => void;
	onCreateProfile: () => void;
	onPlay: () => void;
	onStop: () => void;
	onLogout: () => void;
	onError: (message: string) => void;
};

/**
 * L'accueil: barre de raccourcis, actualites, instances, lancement et
 * personnage.
 *
 * <p>Il vivait dans le composant racine, entre les dix-sept etats de celui-ci
 * et la pile de ses huit fenetres. Il n'en lit desormais que ce qu'il montre,
 * et ne connait de la mecanique que des rappels: il ne sait ni comment un jeu
 * se lance, ni comment un profil se cree.
 *
 * <p>L'ouverture du menu reste un etat interne. Personne d'autre ne la lit, et
 * la remonter obligeait le composant racine a la porter pour rien.
 */
export function HomeScreen({
	background,
	news,
	profiles,
	mainProfile,
	modCount,
	account,
	lobbyCape,
	running,
	progress,
	onOpen,
	onSelectProfile,
	onCreateProfile,
	onPlay,
	onStop,
	onLogout,
	onError,
}: HomeScreenProps) {
	const { t } = useTranslation();
	const [menuOpen, setMenuOpen] = useState(false);
	const prefersReducedMotion = useReducedMotion();

	// Toutes les instances, et non les trois premieres: la piste en montre
	// trois a la fois et la molette fait defiler les suivantes. Avec l'ancien
	// decoupage, une quatrieme instance restait invisible depuis l'accueil.
	const displayProfiles: (LauncherProfile | null)[] =
		profiles.length > 0 ? profiles : [null];

	/** Ouvre le dossier de l'instance courante dans l'explorateur. */
	async function openInstanceFolder() {
		// Le dossier n'existe qu'apres un premier lancement: on le dit plutot que
		// de laisser le bouton sans effet.
		if (!mainProfile) return;
		try {
			await invoke("open_instance_folder", { profileId: mainProfile.id });
		} catch (e) {
			onError(
				typeof e === "string"
					? e
					: "Dossier introuvable. Lance l'instance une fois.",
			);
		}
	}

	// `main` n'impose plus de hauteur minimale. Les 520 pixels qu'elle exigeait
	// depassaient la fenetre des qu'elle etait plus courte, et la section etant
	// en overflow-hidden, le bouton de lancement etait rogne en silence -- de
	// trente-cinq pixels exactement a 485 de haut, la taille d'origine du
	// launcher. Le plancher est desormais tenu la ou il doit l'etre: sur la
	// rangee de vignettes, qui a son propre min-h et se resserre avant de
	// deborder.
	return (
		<main className="flex min-h-0 flex-1 items-center justify-center">
			<div className="w-full h-full relative">
				{/*
				  Deux colonnes, et non une colonne avec deux elements poses
				  par-dessus. Le personnage et le menu etaient en position absolue,
				  donc hors du flux: la colonne de gauche ignorait leur existence et
				  se reservait la place a la main, en pourcentages qui devaient rester
				  d'accord avec ceux du personnage. Ils ne l'etaient pas toujours.

				  Le panneau du personnage monte jusqu'en haut de la fenetre et la
				  barre de raccourcis passe par-dessus, sur toute la largeur. C'est la
				  seule facon d'avoir les deux: une barre logee dans la colonne de
				  gauche la raccourcissait au point de n'y laisser que deux
				  raccourcis, et un panneau commencant sous la barre perdait cent
				  pixels de hauteur.
				*/}
				<section
					aria-label="Interface principale du jeu"
					className="absolute inset-0 flex h-full w-full gap-7 overflow-hidden p-7 lg:p-10"
					style={background}
				>
					{/* EN-TÊTE / HEADER BLOCK & SLIDE INDICATORS */}
					{/* La barre va jusqu'au bord droit et le carre du menu se pose
					    dessus, plutot que d'etre range a cote. En le rangeant a cote,
					    l'ecart entre les deux laissait passer un morceau de bordure du
					    panneau -- un trait violet errant entre la barre et le carre. */}
					<div className="absolute inset-x-7 top-7 z-30 flex flex-col gap-3 lg:inset-x-10 lg:top-10">
						<HomeActionBar
							modCount={modCount}
							instanceCount={profiles.length}
							onAction={async (action) => {
								if (action === "instances") return onOpen("profils");
								if (action === "dossier") return openInstanceFolder();
								onOpen(action);
							}}
						/>
						<img
							alt=""
							aria-hidden="true"
							className="ml-4 h-2 w-[104px]"
							src="/assets/slide-indicators.svg"
						/>
					</div>

					{/* SLIDING MENU */}
					{/* Replie, c'est le carre violet du coin: la seule pastille de
					    couleur du haut de l'ecran, donc la premiere chose que l'oeil
					    trouve quand il cherche le menu. Deplie, le carre redevient
					    sobre -- une colonne de six icones sur un degrade violet ne se
					    lirait plus. */}
					<motion.div
						{...(prefersReducedMotion
							? {}
							: { animate: { height: menuOpen ? 480 : 64 } })}
						className={`absolute right-7 top-7 z-40 flex w-16 flex-col overflow-hidden rounded-[18px] lg:right-10 lg:top-10 ${
							menuOpen ? "border border-[#2c2447] bg-[#1e1832]" : ""
						}`}
						initial={false}
						transition={{ height: { duration: 0.3, ease: "easeInOut" } }}
					>
						{/* Replie, le carre fait exactement la hauteur de la barre sur
						    laquelle il se pose: 64 pixels, bords alignes en haut comme en
						    bas. Un carre plus petit aurait flotte au milieu d'elle au lieu
						    de la terminer. */}
						<div className="flex h-16 w-full shrink-0 items-center justify-center">
							<button
								aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
								aria-expanded={menuOpen}
								type="button"
								onClick={() => setMenuOpen(!menuOpen)}
								className={`group flex shrink-0 items-center justify-center transition-[filter,background-color] ${
									menuOpen
										? "h-10 w-10 rounded-[10px] hover:bg-[#2c2447]"
										: "bubble-primary h-16 w-16 rounded-[18px] hover:brightness-110"
								}`}
							>
								{menuOpen ? (
									<X className="h-6 w-6 text-gray-400 transition-colors group-hover:text-white" />
								) : (
									<Menu className="h-6 w-6" />
								)}
							</button>
						</div>

						{menuOpen && (
							<motion.div
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								className="flex flex-col items-center flex-1 w-full mt-4 pb-4"
							>
								<div className="flex flex-col items-center gap-4">
									{MENU_ITEMS.map(({ modal, icon: Icon, title }) => (
										<button
											key={modal}
											type="button"
											onClick={() => {
												onOpen(modal);
												setMenuOpen(false);
											}}
											className={MENU_BUTTON}
											title={title}
										>
											<Icon className="w-5 h-5 text-gray-400 group-hover:text-white" />
										</button>
									))}
								</div>

								<div className="flex flex-col items-center mt-auto gap-4">
									{/* Logo Paranoia, juste au-dessus de la sortie. */}
									<div className="w-9 h-9 shrink-0 rounded-[10px] bg-gradient-to-br from-[#8b5cf6] to-[#6d35e0] flex items-center justify-center text-white font-black text-sm shadow-lg shadow-[#8b5cf6]/20">
										P
									</div>
									<div className="w-6 h-[1px] bg-[#2c2447]" />
									<button
										type="button"
										onClick={() => {
											onLogout();
											setMenuOpen(false);
										}}
										className="w-10 h-10 flex items-center justify-center rounded-[10px] hover:bg-red-500/20 transition-colors group relative"
										title="Déconnexion"
									>
										<LogOut className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
									</button>
								</div>
							</motion.div>
						)}
					</motion.div>

					{/* La reserve en haut est celle de la barre en surimpression:
					    hauteur de la barre, des points, et de leur ecart. */}
					<div className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 pt-[96px]">
						{/* ACTUALITÉS */}
						<NewsCard news={news} />

						{/* La rangee prend tout ce qui reste entre les actualites et le
						    lancement, dans la limite de ses bornes: pas de vignettes
						    ecrasees sur un ecran court, pas de vignettes demesurees sur un
						    grand.

						    Il faut les deux reglages, et c'est ce qui manquait. Avec flex-1
						    seul, une fois le plafond atteint l'espace restant n'allait a
						    personne et le lancement remontait au milieu de la colonne. Avec
						    une hauteur calculee seule, la rangee ne prenait pas la place
						    disponible et les vignettes devenaient carrees. flex-1 les fait
						    grandir, le mt-auto du lancement absorbe ce qui depasse.

						    Le bouton d'ajout reste en dehors de la piste. Place a
						    l'interieur, il sortait du champ des la troisieme instance et
						    donnait l'impression qu'on ne pouvait pas en creer plus. */}
							<div className="flex min-h-[116px] max-h-[212px] min-w-0 flex-1 flex-row items-stretch gap-3 xl:gap-4">
								<div
									onWheel={(event) => {
										// Meme conversion que la barre du haut: une molette de
										// souris ne produit que du deplacement vertical.
										if (event.deltaY !== 0) {
											event.currentTarget.scrollLeft += event.deltaY;
										}
									}}
									// Sans flex-1: la piste doit se dimensionner sur ses
									// vignettes et ne se resserrer que faute de place. En flex-1
									// elle prenait toute la largeur libre, ce qui repoussait le
									// bouton d'ajout a l'autre bout de la rangee -- separe des
									// cases dont il est la suite.
									// items-stretch et non items-center: les vignettes prennent
									// desormais la hauteur de la rangee, il faut donc qu'elles
									// la recoivent.
									className="no-scrollbar flex h-full min-w-0 flex-row flex-nowrap items-stretch gap-3 overflow-x-auto scroll-smooth xl:gap-4"
								>
									{displayProfiles.map((profile) => (
										<InstanceCard
											key={profile ? profile.id : "vide"}
											label={
												profile
													? profile.name
													: t("home.new_instance", "Nouvelle instance")
											}
											{...(profile
												? {
														version: profile.minecraftVersion,
														detail: profile.profileTypeId,
													}
												: {})}
											isSelected={
												profile ? profile.id === mainProfile?.id : false
											}
											onClick={() => {
												if (!profile) return onCreateProfile();
												// Selection d'abord: le menu qui s'ouvre, le bouton
												// Jouer et le compteur de mods parlent tous de
												// l'instance courante.
												onSelectProfile(profile.id);
												onOpen("instance");
											}}
										/>
									))}
								</div>

								<button
									aria-label="Ajouter une instance"
									title="Nouvelle instance"
									className={`group grid ${CARD_SIZE} shrink-0 place-items-center rounded-[22px] bubble transition-[border-color] hover:border-[#8b5cf6] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#8b5cf6]`}
									onClick={onCreateProfile}
									type="button"
								>
									<img
										alt=""
										aria-hidden="true"
										className="size-10 opacity-60 transition-opacity group-hover:opacity-100"
										src="/assets/plus-square.svg"
									/>
								</button>
							</div>

							<div className="mt-auto flex w-full max-w-[440px] shrink-0 items-center gap-4">
								<button
									aria-label={running ? "Arrêter" : "Lancer"}
									disabled={!mainProfile}
									className={`relative flex h-[54px] min-w-0 flex-1 items-center justify-center overflow-hidden rounded-full px-6 text-sm font-semibold transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-not-allowed disabled:opacity-50 ${running ? "bg-red-600 text-white focus-visible:outline-red-500" : "bubble-primary focus-visible:outline-[#8b5cf6]"}`}
									onClick={running ? onStop : onPlay}
									type="button"
								>
									{running && (
										<div
											className="absolute inset-0 bg-red-800"
											style={{ width: `${progress * 100}%` }}
										/>
									)}
									<span className="relative z-10 flex items-center justify-center gap-2">
										{running ? (
											<>
												<X className="h-5 w-5 fill-current" />
												{t("home.stop", "Arrêter")}
											</>
										) : (
											<>
												<Play className="h-4 w-4 fill-current" />
												{t("home.play", "Jouer")}
											</>
										)}
									</span>
								</button>

								{/* Gestionnaire de mods Modrinth. Il n'etait plus atteignable
								    que par le menu replie en haut a droite, ou personne ne le
								    trouvait.

								    Carres, et de la hauteur du bouton de lancement: la largeur
								    variable du compteur -- « Mods », puis « 12 mods » --
								    faisait glisser le bouton des journaux d'un cote a l'autre
								    selon le profil ouvert. */}
								<button
									aria-label="Gerer les mods"
									title="Installer des mods depuis Modrinth"
									disabled={!mainProfile}
									onClick={() => onOpen("mods")}
									className="bubble flex size-[54px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[16px] text-white transition-[border-color] hover:border-[#8b5cf6] disabled:cursor-not-allowed disabled:opacity-50"
									type="button"
								>
									<Pickaxe className="h-5 w-5" />
									<span className="text-[10px] leading-none text-[#9a92b6]">
										{modCount ?? "Mods"}
									</span>
								</button>

								{/* Logs du jeu */}
								<button
									aria-label="Consulter les logs"
									title="Consulter les logs du jeu"
									disabled={!mainProfile}
									onClick={() => onOpen("logs")}
									className="bubble flex size-[54px] shrink-0 flex-col items-center justify-center gap-0.5 rounded-[16px] text-white transition-[border-color] hover:border-[#8b5cf6] disabled:cursor-not-allowed disabled:opacity-50"
									type="button"
								>
									<Terminal className="h-5 w-5" />
									<span className="text-[10px] leading-none text-[#9a92b6]">
										Logs
									</span>
								</button>
							</div>
						</div>

					{/* PERSONNAGE 3D */}
					{/* Dans un cadre, et non pose sur le fond. Sans bord, le personnage
					    flottait dans le vide a droite et la fenetre paraissait vide de ce
					    cote. Masque sous md: la place n'y suffit plus, et l'amputer
					    profiterait a personne.

					    Le cadrage recule par rapport au vestiaire: dans un panneau
					    etroit et haut, le zoom d'origine coupait la tete et les pieds. */}
					{/* 30 % et non 36 %: c'est la largeur du panneau qui plafonnait la
					    taille des vignettes. A 36 %, la colonne de gauche ne laissait que
					    116 pixels par case pour en garder quatre visibles -- soit quatre
					    de plus que les 112 d'alors, autant dire rien. Les six points
					    rendus ici valent seize pixels par vignette. */}
					<div className="bubble-frame hidden w-[30%] min-w-[240px] max-w-[380px] shrink-0 items-end justify-center overflow-hidden rounded-[26px] md:flex">
						<SkinViewer3D
							className="h-full w-full"
							zoom={0.62}
							skinUrl={
								account?.minecraftUsername
									? `https://minotar.net/skin/${account.minecraftUsername}`
									: "https://minotar.net/skin/Steve"
							}
							{...(lobbyCape ? { capeUrl: lobbyCape } : {})}
							paused={running}
						/>
					</div>
				</section>
			</div>
		</main>
	);
}

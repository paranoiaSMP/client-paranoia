import { AlertTriangle, LogIn, Pickaxe } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MicrosoftAccount } from "@paranoia/contracts";

import { TitleBar } from "../shell/TitleBar";

/*
 * Les trois ecrans que l'application montre a la place d'elle-meme: l'echec du
 * demarrage, l'attente, et la connexion.
 *
 * Tous les trois portent la barre de titre. Ce n'est pas une coquetterie: la
 * fenetre est en `decorations: false`, donc sans cette barre elle n'a ni
 * bouton de fermeture ni zone de deplacement. Un ecran d'erreur dont on ne
 * peut pas sortir serait pire que l'erreur qu'il annonce.
 */

/** La coquille minimale: de quoi fermer la fenetre, et rien d'autre. */
function Frame({ children }: { children: React.ReactNode }) {
	return (
		<div className="flex h-screen w-full flex-col overflow-hidden bg-ground">
			<TitleBar />
			<div className="flex min-h-0 flex-1 items-center justify-center p-8">
				{children}
			</div>
		</div>
	);
}

/** Le service local n'a pas repondu. Le seul ecran qui propose une action. */
export function BootstrapErrorScreen({
	error,
	onRetry,
}: {
	error: string | null;
	onRetry: () => void;
}) {
	const { t } = useTranslation();

	return (
		<Frame>
			<div className="flex w-full max-w-md flex-col items-center gap-4 text-center">
				<AlertTriangle className="size-12 text-danger" strokeWidth={2} />
				<h1 className="text-lg font-bold">{t("app.error_title")}</h1>
				<p className="text-sm text-neutral-300">{t("app.error_hint")}</p>
				{error && (
					<p className="w-full break-words rounded-md border border-divider bg-surface px-3 py-2 font-mono text-xs text-neutral-500">
						{error}
					</p>
				)}
				<button
					type="button"
					onClick={onRetry}
					className="mt-2 rounded-md border-2 border-accent px-6 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
				>
					{t("app.retry")}
				</button>
			</div>
		</Frame>
	);
}

/** Le temps que le service local ecoute et que le catalogue arrive. */
export function LoadingScreen() {
	const { t } = useTranslation();

	return (
		<Frame>
			<div className="flex animate-pulse flex-col items-center gap-4">
				<Pickaxe
					className="size-16 animate-bounce text-accent-600"
					strokeWidth={2.5}
				/>
				<span className="font-display text-sm uppercase tracking-widest text-neutral-400">
					{t("app.loading")}
				</span>
			</div>
		</Frame>
	);
}

type LoginScreenProps = {
	account: MicrosoftAccount | null;
	accounts: MicrosoftAccount[];
	connectingMicrosoft: boolean;
	devModeAvailable: boolean;
	onConnectMicrosoft: () => void;
	onLocalDevContinue: () => void;
	onSwitchAccount: (account: MicrosoftAccount) => void;
	onLogout: () => void;
};

/**
 * Personne n'est connecte.
 *
 * <p>L'ecran portait la barre du haut de l'ancienne interface, uniquement pour
 * le bouton de connexion qu'elle contenait. La barre a disparu avec le reste;
 * le bouton est donc ici, ou il est de toute facon la seule chose a faire.
 *
 * <p>Les comptes deja enregistres sont proposes directement: apres une
 * deconnexion, se reconnecter ne devrait pas repasser par Microsoft.
 */
export function LoginScreen({
	accounts,
	connectingMicrosoft,
	devModeAvailable,
	onConnectMicrosoft,
	onLocalDevContinue,
	onSwitchAccount,
}: LoginScreenProps) {
	return (
		<Frame>
			<div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
				<span className="grid size-14 place-items-center rounded-lg bg-gradient-to-br from-accent-600 to-accent-500 text-2xl font-black text-accent-100">
					P
				</span>

				<div className="flex flex-col gap-1.5">
					<h1 className="m-0 text-2xl font-semibold">Paranoia Client</h1>
					<p className="m-0 text-sm text-neutral-300">
						Connecte-toi avec ton compte Microsoft pour jouer.
					</p>
				</div>

				<button
					type="button"
					onClick={onConnectMicrosoft}
					disabled={connectingMicrosoft}
					className="flex w-full items-center justify-center gap-2 rounded-md border-2 border-accent px-6 py-3 text-sm font-semibold text-accent shadow-[0_0_34px_-6px_var(--color-accent)] transition-[filter] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50"
				>
					<LogIn className="size-4" />
					{connectingMicrosoft ? "Connexion…" : "Se connecter avec Microsoft"}
				</button>

				{accounts.length > 0 && (
					<div className="flex w-full flex-col gap-2">
						<span className="text-xs uppercase tracking-[0.14em] text-neutral-400">
							Comptes enregistrés
						</span>
						{accounts.map((entry) => (
							<button
								key={entry.id}
								type="button"
								onClick={() => onSwitchAccount(entry)}
								className="flex items-center gap-3 rounded-md bg-surface p-2 text-left transition-colors hover:bg-well focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
							>
								<span className="size-8 shrink-0 overflow-hidden rounded-sm bg-gradient-to-br from-accent-700 to-accent-500">
									<img
										alt=""
										className="size-full"
										src={`https://minotar.net/helm/${entry.minecraftUsername}/64`}
									/>
								</span>
								<span className="truncate text-sm font-medium">
									{entry.minecraftUsername}
								</span>
							</button>
						))}
					</div>
				)}

				{devModeAvailable && (
					<button
						type="button"
						onClick={onLocalDevContinue}
						className="text-xs text-neutral-500 underline-offset-4 hover:text-neutral-300 hover:underline"
					>
						Continuer sans compte (développement)
					</button>
				)}
			</div>
		</Frame>
	);
}

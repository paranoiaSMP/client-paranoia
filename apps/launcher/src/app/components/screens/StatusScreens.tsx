import type { CSSProperties } from "react";
import { AlertTriangle, Pickaxe } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MicrosoftAccount } from "@paranoia/contracts";

import { TopBar } from "../TopBar";

/*
 * Les trois ecrans que l'accueil montre a la place de lui-meme: l'echec du
 * demarrage, l'attente, et la connexion. Ils etaient trois retours anticipes
 * au milieu du composant racine, entre les effets et le rendu principal, ce
 * qui obligeait a les traverser pour atteindre l'accueil.
 */

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
		<div className="min-h-screen flex items-center justify-center bg-sunken p-8">
			<div className="max-w-md w-full text-center flex flex-col items-center gap-4">
				<AlertTriangle className="w-12 h-12 text-accent-red" strokeWidth={2} />
				<h1 className="text-white text-lg font-bold">{t("app.error_title")}</h1>
				<p className="text-[#9a92b6] text-sm">{t("app.error_hint")}</p>
				{error && (
					<p className="text-[#7a7194] text-xs font-mono bg-[#1a1529] border border-[#241d3c] rounded-lg px-3 py-2 w-full break-words">
						{error}
					</p>
				)}
				<button
					type="button"
					onClick={onRetry}
					className="mt-2 bg-accent-purple hover:bg-accent-purple-dark text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition-colors"
				>
					{t("app.retry")}
				</button>
			</div>
		</div>
	);
}

/** Le temps que le service local ecoute et que le catalogue arrive. */
export function LoadingScreen() {
	const { t } = useTranslation();

	return (
		<div className="min-h-screen flex items-center justify-center bg-sunken">
			<div className="animate-pulse flex flex-col items-center gap-4">
				<Pickaxe
					className="w-16 h-16 text-accent-purple-dark animate-bounce"
					strokeWidth={2.5}
				/>
				<span className="text-white/60 tracking-widest text-sm uppercase font-outfit">
					{t("app.loading")}
				</span>
			</div>
		</div>
	);
}

type LoginScreenProps = {
	background: CSSProperties;
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
 * <p>La barre du haut est conservee: c'est elle qui porte la connexion, et un
 * ecran nu obligerait a la faire reapparaitre ailleurs.
 */
export function LoginScreen({ background, ...topBar }: LoginScreenProps) {
	return (
		<div
			className="h-screen w-full flex flex-col overflow-hidden"
			style={background}
		>
			<TopBar connected={false} {...topBar} />
			<div className="flex-1 flex items-center justify-center">
				<div className="text-center space-y-4">
					<h2 className="text-2xl font-bold text-white">Connexion requise</h2>
					<p className="text-gray-400">
						Veuillez vous connecter pour accéder au launcher.
					</p>
				</div>
			</div>
		</div>
	);
}

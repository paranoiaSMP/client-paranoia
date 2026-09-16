import { useState } from "react";
import { LogOut } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { LauncherProfile } from "@paranoia/contracts";

import { importProfile } from "../../../shared/api/profilesClient";
import { ParametresTab } from "../tabs/ParametresTab";
import { ScreenHeader } from "./ScreenHeader";

type SettingsScreenProps = {
	error: string | null;
	setError: (message: string | null) => void;
	refreshProfiles: () => Promise<unknown>;
	/** Rappele apres un enregistrement, pour que le bandeau du bas suive. */
	onSaved: () => void;
	onLogout: () => void;
};

/**
 * Les reglages, et la deconnexion.
 *
 * <p>L'import d'un profil colle en JSON vivait dans la pile des fenetres, alors
 * qu'il ne sert qu'ici. Il redescend dans l'ecran qui l'affiche.
 *
 * <p>La deconnexion etait au fond du menu replie, sous un trait. Elle est ici,
 * en bas des reglages: c'est le seul endroit ou on la cherche, et le seul ou
 * l'on ne risque pas de cliquer dessus par megarde.
 */
export function SettingsScreen({
	error,
	setError,
	refreshProfiles,
	onSaved,
	onLogout,
}: SettingsScreenProps) {
	const { t } = useTranslation();
	const [importJson, setImportJson] = useState("");

	async function handleImportProfile() {
		try {
			const parsed = JSON.parse(importJson) as Partial<LauncherProfile>;
			if (
				!parsed.name ||
				!parsed.minecraftVersion ||
				!parsed.profileTypeId ||
				!parsed.graphicsModeId ||
				!parsed.ramMb ||
				!parsed.resolution
			) {
				throw new Error(t("settings.import_error"));
			}
			await importProfile({
				name: parsed.name,
				minecraftVersion: parsed.minecraftVersion,
				profileTypeId: parsed.profileTypeId,
				graphicsModeId: parsed.graphicsModeId,
				ramMb: parsed.ramMb,
				resolution: parsed.resolution,
			});
			setImportJson("");
			await refreshProfiles();
		} catch (e) {
			setError(
				e instanceof Error ? e.message : t("settings.import_format_error"),
			);
		}
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-6">
			<ScreenHeader
				title="Paramètres"
				subtitle="Java, mémoire et fenêtre de jeu."
			>
				<button
					type="button"
					onClick={onLogout}
					className="flex items-center gap-1.5 whitespace-nowrap rounded-md border border-divider px-3 py-2 text-[13.5px] font-medium text-neutral-300 transition-colors hover:border-danger hover:text-danger focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
				>
					<LogOut className="size-3.5" />
					Déconnexion
				</button>
			</ScreenHeader>

			<ParametresTab
				importJson={importJson}
				setImportJson={setImportJson}
				handleImportProfile={handleImportProfile}
				error={error}
				onSaved={onSaved}
			/>
		</div>
	);
}

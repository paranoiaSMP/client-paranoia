import type { LauncherProfile } from "@paranoia/contracts";

const LOADERS: Record<string, string> = {
	fabric: "Fabric",
	vanilla: "Vanilla",
	forge: "Forge",
	neoforge: "NeoForge",
	quilt: "Quilt",
};

export function loaderLabel(profileTypeId: string): string {
	return LOADERS[profileTypeId] ?? profileTypeId.charAt(0).toUpperCase() + profileTypeId.slice(1);
}

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

/** « il y a 3 heures », ou « jamais lancée » pour une instance qui n'a pas servi. */
export function lastPlayedLabel(profile: Pick<LauncherProfile, "lastPlayedAt">): string {
	if (!profile.lastPlayedAt) return "Jamais lancée";

	const elapsedMs = Date.parse(profile.lastPlayedAt) - Date.now();
	if (Number.isNaN(elapsedMs)) return "Jamais lancée";

	const minutes = Math.round(elapsedMs / 60_000);
	if (Math.abs(minutes) < 60) return `Jouée ${relative.format(minutes, "minute")}`;
	const hours = Math.round(minutes / 60);
	if (Math.abs(hours) < 48) return `Jouée ${relative.format(hours, "hour")}`;
	return `Jouée ${relative.format(Math.round(hours / 24), "day")}`;
}

export function formatCount(count: number): string {
	if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)} M`;
	if (count >= 1_000) return `${(count / 1_000).toFixed(1)} k`;
	return String(count);
}

export function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
	if (bytes >= 1024) return `${Math.round(bytes / 1024)} Ko`;
	return `${bytes} o`;
}

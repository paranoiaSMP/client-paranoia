import fs from "node:fs";
import path from "node:path";
import JSZip from "jszip";
import { createProfile } from "./profiles.store.js";
import { instanceDir } from "../launcher/paths.js";

async function resolveModrinthHash(hash: string): Promise<string | null> {
	try {
		const res = await fetch(`https://api.modrinth.com/v2/version_file/${hash}?algorithm=sha1`);
		if (!res.ok) return null; // Ignore silencieusement les 404 (mods Lunar internes)
		const data = await res.json();
		return data.files?.[0]?.url || null;
	} catch (e) {
		return null;
	}
}

async function downloadFile(url: string, dest: string) {
	const res = await fetch(url);
	if (!res.ok || !res.body) throw new Error(`Erreur HTTP: ${res.status}`);
	const buffer = await res.arrayBuffer();
	fs.writeFileSync(dest, Buffer.from(buffer));
}

export async function importLunarPack(filePath: string) {
	const data = fs.readFileSync(filePath);
	const zip = await JSZip.loadAsync(data);
	const metadataFile = zip.file("metadata.json");

	if (!metadataFile) throw new Error("metadata.json introuvable dans le .lcpack");

	const metadataStr = await metadataFile.async("string");
	const metadata = JSON.parse(metadataStr);

	const profileName = path.basename(filePath, ".lcpack");
	const profile = createProfile({
		name: `Lunar - ${profileName}`,
		minecraftVersion: metadata.gameVersion || metadata.majorGameVersion || "1.21.1",
		profileTypeId: metadata.loaders?.includes("fabric") ? "fabric" : "vanilla",
		graphicsModeId: "fast",
		ramMb: 4096,
		resolution: "1920x1080"
	});

	const targetDir = instanceDir(profile.id);
	fs.mkdirSync(targetDir, { recursive: true });

	const extractPromises = Object.entries(zip.files)
		.filter(([rel, f]) => rel.startsWith("overrides/") && !f.dir)
		.map(async ([rel, f]) => {
			const targetPath = path.join(targetDir, rel.replace(/^overrides\//, ""));
			fs.mkdirSync(path.dirname(targetPath), { recursive: true });
			const buffer = await f.async("nodebuffer");
			fs.writeFileSync(targetPath, buffer);
		});

	await Promise.all(extractPromises);

	const modsDir = path.join(targetDir, "mods");
	const shadersDir = path.join(targetDir, "shaderpacks");
	
	fs.mkdirSync(modsDir, { recursive: true });
	fs.mkdirSync(shadersDir, { recursive: true });

	const processItem = async (item: any, outDir: string, defaultExt: string) => {
		if (!item.hash) return;
		const url = await resolveModrinthHash(item.hash);
		if (!url) return;
		const fileName = new URL(url).pathname.split('/').pop() || `${item.hash}.${defaultExt}`;
		await downloadFile(url, path.join(outDir, fileName)).catch(() => {});
	};

	const downloadPromises: Promise<void>[] = [];
	
	if (Array.isArray(metadata.mods)) {
		downloadPromises.push(...metadata.mods.map((m: any) => processItem(m, modsDir, "jar")));
	}
	
	if (Array.isArray(metadata.shaders)) {
		downloadPromises.push(...metadata.shaders.map((s: any) => processItem(s, shadersDir, "zip")));
	}

	await Promise.all(downloadPromises);

	return profile;
}
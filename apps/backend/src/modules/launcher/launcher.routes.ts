import { Router } from "express";
import { z } from "zod";
import {
	launchMinecraft,
	getLaunchStatus,
	cancelLaunch,
	getGameLogs,
	clearGameLogs,
} from "./launcher.service.js";
import { markProfilePlayed } from "../profiles/profiles.store.js";
import { detecteJava, sondeJava } from "./javaDetect.js";
import { sessionDeLancement } from "../auth/auth.session.js";
import { EchecRenouvellement } from "../auth/auth.microsoft.js";

export const launcherRouter = Router();

const playSchema = z.object({
	profileId: z.string().min(1),
	minecraftVersion: z.string().min(1),
	ramMb: z.number().int().positive(),
	account: z.object({
		// Absent des launchers anterieurs a la 0.7.31: on retombe alors sur le
		// pseudonyme pour retrouver la session enregistree.
		id: z.string().optional(),
		minecraftUuid: z.string(),
		minecraftUsername: z.string(),
		accessToken: z.string(),
	}),
});

launcherRouter.post("/play", async (req, res, next) => {
	try {
		const body = playSchema.parse(req.body);
		const account = await sessionDeLancement(body.account);

		// Note ici, et non a la fin du lancement: c'est l'instance qu'on a
		// choisi de jouer qui doit remonter en tete, meme si le telechargement
		// echoue ensuite. On la retrouve ainsi en premier au prochain
		// demarrage, ce qui est justement le moment ou on veut reessayer.
		markProfilePlayed(body.profileId);

		// We don't await the launch here because it takes a long time and stays open
		// We just start the process and return success
		launchMinecraft(
			body.profileId,
			body.minecraftVersion,
			body.ramMb,
			account,
		).catch((err: unknown) => {
			console.error("[Launcher] Game launch failed:", err);
		});

		res.json({ status: "launching" });
	} catch (err) {
		// Le renouvellement echoue avant le lancement: on repond tout de suite,
		// plutot que de laisser le joueur attendre le telechargement pour voir
		// Minecraft afficher « Invalid session » a la fin.
		if (err instanceof EchecRenouvellement) {
			return res.status(err.definitif ? 401 : 503).json({
				message: err.definitif
					? "Session Microsoft expiree: reconnecte-toi pour jouer."
					: `Session non renouvelee (${err.message}). Reessaie dans un instant.`,
			});
		}
		next(err);
	}
});

/**
 * Les Java installes sur la machine, pour que le joueur choisisse au lieu de
 * taper un chemin absolu qu'il ne connait pas.
 */
launcherRouter.get("/java", async (_req, res, next) => {
	try {
		return res.json(await detecteJava());
	} catch (err) {
		return next(err);
	}
});

/**
 * Verifie un chemin saisi a la main et rend ce que la JVM declare.
 *
 * <p>Repondre « ce fichier n'est pas un Java » au moment ou on le choisit vaut
 * mieux que de le decouvrir a l'echec du lancement, apres le telechargement.
 */
launcherRouter.post("/java/verifier", async (req, res, next) => {
	try {
		const { chemin } = z
			.object({ chemin: z.string().min(1).max(512) })
			.parse(req.body);
		return res.json(await sondeJava(chemin));
	} catch (err) {
		return next(err);
	}
});

launcherRouter.get("/status/:profileId", (req, res) => {
	const status = getLaunchStatus(req.params.profileId);
	res.json(status);
});

launcherRouter.post("/cancel/:profileId", (req, res) => {
	cancelLaunch(req.params.profileId);
	res.json({ status: "canceled" });
});

launcherRouter.get("/logs", (_req, res) => {
	res.json({ logs: getGameLogs() });
});

launcherRouter.post("/logs/clear", (_req, res) => {
	clearGameLogs();
	res.json({ status: "cleared" });
});


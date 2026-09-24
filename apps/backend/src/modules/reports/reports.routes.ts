import { Router } from "express";
import os from "node:os";
import { z } from "zod";
import { logger } from "../../logger.js";
import { env } from "../../config/env.js";

export const reportsRouter = Router();

const reportSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(4000),
  category: z.string().default("Crash"),
  accountName: z.string().optional(),
  systemInfo: z
    .object({
      ramMaxMb: z.number().nullable().optional(),
      launcherVersion: z.string().optional(),
      minecraftVersion: z.string().optional(),
      profileName: z.string().optional(),
    })
    .optional(),
  logs: z.string().optional(),
});

reportsRouter.post("/bug", async (req, res, next) => {
  try {
    const data = reportSchema.parse(req.body);
    const webhookUrl = env.BUG_REPORT_WEBHOOK_URL;

    if (!webhookUrl) {
      logger.warn({ data }, "Signalement reçu sans webhook Discord configuré");
      return res.status(200).json({
        success: true,
        warning: "Aucun webhook Discord n'est configuré (BUG_REPORT_WEBHOOK_URL).",
      });
    }

    const isCrash = data.category.toLowerCase().includes("crash");
    const color = isCrash ? 0xef4444 : 0xa855f7;

    const osName = `${os.type()} ${os.release()} (${os.arch()})`;
    const ramSystem = `${Math.round(os.totalmem() / (1024 * 1024 * 1024))} Go`;
    const ramAllocated = data.systemInfo?.ramMaxMb
      ? `${Math.round(data.systemInfo.ramMaxMb / 1024)} Go`
      : "Non spécifié";

    const fields = [
      {
        name: "👤 Joueur",
        value: data.accountName || "Anonyme",
        inline: true,
      },
      {
        name: "🏷️ Catégorie",
        value: data.category,
        inline: true,
      },
      {
        name: "🎮 Instance",
        value: `${data.systemInfo?.profileName ?? "Instance inconnue"} ${
          data.systemInfo?.minecraftVersion ? `(MC ${data.systemInfo.minecraftVersion})` : ""
        }`,
        inline: true,
      },
      {
        name: "💻 Système",
        value: `${osName} · RAM totale: ${ramSystem} · RAM allouée: ${ramAllocated}`,
        inline: false,
      },
      {
        name: "📝 Description",
        value: data.description.slice(0, 1024),
        inline: false,
      },
    ];

    const embed = {
      title: `🐛 Signalement : ${data.title.slice(0, 250)}`,
      color,
      fields,
      footer: {
        text: `Paranoia Client v${data.systemInfo?.launcherVersion ?? "0.7.18"}`,
      },
      timestamp: new Date().toISOString(),
    };

    const payload = { embeds: [embed] };

    let response: Response;
    if (data.logs && data.logs.trim().length > 0) {
      const formData = new FormData();
      formData.append("payload_json", JSON.stringify(payload));
      const blob = new Blob([data.logs], { type: "text/plain" });
      formData.append("files[0]", blob, "logs.txt");

      response = await fetch(webhookUrl, {
        method: "POST",
        body: formData,
      });
    } else {
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      logger.error({ status: response.status, errText }, "Erreur webhook Discord");
      return res.status(502).json({
        success: false,
        message: `Erreur webhook Discord (${response.status})`,
      });
    }

    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
});

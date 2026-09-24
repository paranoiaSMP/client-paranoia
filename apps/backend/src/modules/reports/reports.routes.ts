import { Router } from "express";
import os from "node:os";
import { z } from "zod";
import { logger } from "../../logger.js";
import { env } from "../../config/env.js";
import { readSettings } from "../settings/settings.store.js";

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
      profileType: z.string().optional(),
      graphicsMode: z.string().optional(),
      gpu: z.string().optional(),
      screenResolution: z.string().optional(),
    })
    .optional(),
  logs: z.string().optional(),
});

reportsRouter.post("/bug", async (req, res, next) => {
  try {
    const data = reportSchema.parse(req.body);
    const isCrash = data.category.toLowerCase().includes("crash");
    const color = isCrash ? 0xef4444 : 0xa855f7;

    const cpus = os.cpus();
    const cpuModel = cpus[0]?.model ? cpus[0].model.trim() : "Inconnu";
    const cpuCores = cpus.length;
    const cpuSpeed = cpus[0]?.speed ? `${(cpus[0].speed / 1000).toFixed(2)} GHz` : "";
    const cpuInfo = `${cpuModel} (${cpuCores} cœurs${cpuSpeed ? ` @ ${cpuSpeed}` : ""})`;

    const totalRamGb = (os.totalmem() / (1024 * 1024 * 1024)).toFixed(1);
    const freeRamGb = (os.freemem() / (1024 * 1024 * 1024)).toFixed(1);

    const osPlatform =
      os.platform() === "win32"
        ? "Windows"
        : os.platform() === "darwin"
        ? "macOS"
        : os.platform() === "linux"
        ? "Linux"
        : os.type();
    const osInfo = `${osPlatform} ${os.release()} (${os.arch()})`;

    const settings = readSettings();
    const allocatedRamMb = data.systemInfo?.ramMaxMb ?? settings.ramMaxMb;

    const pcConfigLines = [
      `• **CPU** : ${cpuInfo}`,
      data.systemInfo?.gpu && data.systemInfo.gpu !== "Inconnu"
        ? `• **GPU** : ${data.systemInfo.gpu}`
        : null,
      `• **RAM Totale** : ${totalRamGb} Go (Libre : ${freeRamGb} Go)`,
      `• **Système d'exploitation** : ${osInfo}`,
      data.systemInfo?.screenResolution
        ? `• **Résolution Écran** : ${data.systemInfo.screenResolution}`
        : null,
    ].filter(Boolean);

    const gameConfigLines = [
      `• **RAM Allouée** : ${Math.round(allocatedRamMb / 1024)} Go (${allocatedRamMb} Mo)`,
      `• **Résolution Fenêtre** : ${settings.width}x${settings.height}${settings.fullscreen ? " (Plein écran)" : ""}`,
      data.systemInfo?.graphicsMode
        ? `• **Préréglage Graphique** : ${data.systemInfo.graphicsMode}`
        : null,
      settings.javaPath
        ? `• **Java personnalisé** : \`${settings.javaPath}\``
        : "• **Java** : Runtime automatique Paranoia",
      settings.jvmArgs && settings.jvmArgs !== "-XX:+UseG1GC"
        ? `• **JVM Args** : \`${settings.jvmArgs.slice(0, 160)}${settings.jvmArgs.length > 160 ? "..." : ""}\``
        : null,
    ].filter(Boolean);

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
        name: "🎮 Instance Jouée",
        value: `${data.systemInfo?.profileName ?? "Instance Défaut"} ${
          data.systemInfo?.minecraftVersion ? `· Minecraft ${data.systemInfo.minecraftVersion}` : ""
        } ${data.systemInfo?.profileType ? `· (${data.systemInfo.profileType})` : ""}`,
        inline: false,
      },
      {
        name: "💻 Config PC du Joueur",
        value: pcConfigLines.join("\n"),
        inline: false,
      },
      {
        name: "⚙️ Config Launcher & Jeu",
        value: gameConfigLines.join("\n"),
        inline: false,
      },
      {
        name: "📝 Description du problème",
        value: data.description.slice(0, 1024),
        inline: false,
      },
    ];

    const embed = {
      title: `🐛 Signalement : ${data.title.slice(0, 250)}`,
      color,
      fields,
      footer: {
        text: `Paranoia Client v${data.systemInfo?.launcherVersion ?? "0.7.18"} · ${new Date().toLocaleString("fr-FR")}`,
      },
      timestamp: new Date().toISOString(),
    };

    const sitePayload = {
      title: data.title,
      description: data.description,
      category: data.category,
      accountName: data.accountName,
      systemInfo: {
        ...data.systemInfo,
        cpu: cpuInfo,
        ramSystem: `${totalRamGb} Go (Libre : ${freeRamGb} Go)`,
        ramAllocated: `${Math.round(allocatedRamMb / 1024)} Go (${allocatedRamMb} Mo)`,
        osInfo,
        jvmArgs: settings.jvmArgs,
        javaPath: settings.javaPath,
      },
      logs: data.logs,
    };

    if (env.BUG_REPORT_API_URL) {
      try {
        const siteResponse = await fetch(env.BUG_REPORT_API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sitePayload),
        });

        if (siteResponse.ok) {
          return res.json({ success: true });
        }
        logger.warn({ status: siteResponse.status }, "Échec envoi rapport vers le site web");
      } catch (err) {
        logger.warn({ err }, "Impossible de joindre l'API du site web");
      }
    }

    const webhookUrl = env.BUG_REPORT_WEBHOOK_URL;
    if (!webhookUrl) {
      return res.json({
        success: true,
        warning: "Signalement enregistré localement (aucun récepteur distant actif).",
      });
    }

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

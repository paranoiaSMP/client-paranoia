import { Router } from "express";
import { env } from "../../config/env.js";

export const telemetryRouter = Router();

telemetryRouter.post("/crash-report", async (req, res) => {
  const consent = req.header("x-paranoia-consent") === "true";

  if (!consent) {
    return res.status(403).json({ message: "consent required" });
  }

  try {
    const response = await fetch(env.CRASH_REPORT_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      console.error(`Erreur d'export vers le site web : ${response.status}`);
    }
  } catch (err) {
    console.error("Impossible de contacter le webhook de crash-report", err);
  }

  return res.status(202).json({ accepted: true });
});

telemetryRouter.post("/security-events", (req, res) => {
  const consent = req.header("x-paranoia-consent") === "true";

  if (!consent) {
    return res.status(403).json({ message: "consent required" });
  }

  return res.status(202).json({ accepted: true, event: req.body });
});

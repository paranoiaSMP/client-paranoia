import { Router } from "express";

export const telemetryRouter = Router();

telemetryRouter.post("/security-events", (req, res) => {
  const consent = req.header("x-paranoia-consent") === "true";

  if (!consent) {
    return res.status(403).json({ message: "consent required" });
  }

  return res.status(202).json({ accepted: true, event: req.body });
});

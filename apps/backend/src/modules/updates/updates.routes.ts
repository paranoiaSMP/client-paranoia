import { Router } from "express";

export const updatesRouter = Router();

updatesRouter.get("/latest", (req, res) => {
  const channel =
    typeof req.query.channel === "string" ? req.query.channel : "stable";

  res.json({
    channel,
    version: "0.1.0",
    mandatory: false,
    notes: ["Initial project scaffold"],
    publishedAt: new Date().toISOString(),
  });
});

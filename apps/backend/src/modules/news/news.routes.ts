import { Router } from "express";
import type { NewsItem } from "@paranoia/contracts";

export const newsRouter = Router();

newsRouter.get("/", (_req, res) => {
  const payload: NewsItem[] = [
    {
      id: "welcome",
      title: "Bienvenue sur Paranoia Client",
      excerpt: "Le socle technique est en place.",
      contentHtml: "<p>Le launcher et l API sont prets pour l integration metier.</p>",
      publishedAt: new Date().toISOString(),
      tags: ["release"]
    }
  ];

  res.json(payload);
});

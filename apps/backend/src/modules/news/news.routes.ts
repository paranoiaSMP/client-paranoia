import { Router } from "express";
import type { NewsItem } from "@paranoia/contracts";

export const newsRouter = Router();

newsRouter.get("/", (_req, res) => {
  const payload: NewsItem[] = [
    {
      id: "news-saison-3",
      title: "Test",
      excerpt: "TEST",
      contentHtml: "<h1>Test</h1><p>Test</p>",
      publishedAt: new Date().toISOString(),
      tags: ["news"]
    }
  ];

  res.json(payload);
});

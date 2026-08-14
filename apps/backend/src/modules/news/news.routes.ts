import { Router } from "express";
import { env } from "../../config/env.js";

export const newsRouter = Router();

newsRouter.get("/", async (_req, res) => {
  try {
    const response = await fetch(env.NEWS_API_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch news: ${response.status}`);
    }
    
    const payload = await response.json();
    res.json(payload);
  } catch (error) {
    console.warn("Could not fetch news from remote API, returning empty list.", error);
    // On renvoie un tableau vide pour ne pas faire planter le launcher si le site est down
    res.json([]);
  }
});

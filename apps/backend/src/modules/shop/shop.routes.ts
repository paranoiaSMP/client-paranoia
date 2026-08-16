import { Router } from "express";
import { env } from "../../config/env.js";

export const shopRouter = Router();

shopRouter.get("/catalog", async (req, res, next) => {
  try {
    const response = await fetch(`${env.SHOP_API_URL}/catalog`);
    if (!response.ok) {
      throw new Error(`Failed to fetch catalog: ${response.statusText}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("[Shop] Error fetching catalog:", error);
    res.status(500).json({ error: "Could not fetch catalog" });
  }
});

shopRouter.get("/balance/:uuid", async (req, res, next) => {
  try {
    // The balance route on the site is /api/users/[uuid]/balance
    // We'll construct the URL using the SITE_API_URL to ensure correctness
    const response = await fetch(`${env.SITE_API_URL}/users/${req.params.uuid}/balance`);
    if (!response.ok) {
      throw new Error(`Failed to fetch balance: ${response.statusText}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("[Shop] Error fetching balance:", error);
    res.status(500).json({ error: "Could not fetch balance" });
  }
});

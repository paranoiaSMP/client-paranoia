import "dotenv/config";
import { z } from "zod";

/**
 * Origins the launcher webview can present. The production Tauri webview uses a
 * `tauri://` (macOS/Linux) or `http://tauri.localhost` (Windows) origin, the dev
 * server uses Vite's port.
 */
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
];

const envSchema = z.object({
  // Port dedie plutot que 8080, tres souvent deja pris par un autre service:
  // l'API tourne desormais sur la machine du joueur, pas sur un serveur.
  PORT: z.string().default("47820"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Comma-separated list appended to DEFAULT_ALLOWED_ORIGINS.
  CORS_ALLOWED_ORIGINS: z.string().default(""),

  // Reserved for the modules that are not wired yet (Prisma, JWT sessions,
  // Microsoft app credentials). They are optional so a fresh clone boots:
  // requiring them made `pnpm dev` crash before serving a single route.
  DATABASE_URL: z.string().min(1).optional(),
  JWT_SECRET: z.string().min(16).optional(),
  MICROSOFT_CLIENT_ID: z.string().min(1).optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_REDIRECT_URI: z.string().url().optional(),
});

const parsed = envSchema.parse(process.env);

export const env = {
  ...parsed,
  allowedOrigins: [
    ...DEFAULT_ALLOWED_ORIGINS,
    ...parsed.CORS_ALLOWED_ORIGINS.split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0),
  ],
};

import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("8080"),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  MICROSOFT_CLIENT_ID: z.string().min(1),
  MICROSOFT_CLIENT_SECRET: z.string().default(""),
  MICROSOFT_REDIRECT_URI: z
    .string()
    .url()
    .default("http://localhost:1420/auth/callback"),
});

export const env = envSchema.parse(process.env);

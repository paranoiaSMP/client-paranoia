import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [
    tailwindcss(),
    react(),
    {
      name: "remove-crossorigin",
      transformIndexHtml(html) {
        return html.replace(/\s*crossorigin(="[^"]*")?/g, "");
      },
    },
  ],
  envPrefix: ["VITE_", "PARANOIA_"],
  server: {
    port: 1420,
    strictPort: true,
  },
});

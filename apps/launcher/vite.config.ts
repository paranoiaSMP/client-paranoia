import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  envPrefix: ["VITE_", "PARANOIA_"],
  server: {
    port: 1420,
    strictPort: true,
  },
});

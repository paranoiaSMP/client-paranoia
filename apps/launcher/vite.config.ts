import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  envPrefix: ["VITE_", "PARANOIA_"],
  server: {
    port: 1420,
    strictPort: true
  }
});

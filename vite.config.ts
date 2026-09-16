import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/*
 * Deployed to two places with different roots:
 *   - Vercel / a custom domain -> served at "/"
 *   - GitHub Pages             -> served at "/<repo-name>/"
 * The Pages workflow sets VITE_BASE; everything else uses the root default.
 * src/lib/assets.ts resolves model paths against import.meta.env.BASE_URL,
 * so both builds find public/ correctly.
 */
const base = process.env.VITE_BASE || "/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  server: { port: 5173 },
});

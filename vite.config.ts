import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'production' && process.env.VITE_GH_PAGES === 'true' ? "/gustavosenn/" : "/",
  server: {
    host: "::",
    port: 8080,
    // Serve Lovable CDN assets (lovable-assets pointers) during development;
    // production hosting serves /__l5e/assets-v1 itself.
    proxy:
      mode === "development"
        ? {
            "/__l5e": {
              target: "https://sennafin.lovable.app",
              changeOrigin: true,
            },
          }
        : undefined,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));

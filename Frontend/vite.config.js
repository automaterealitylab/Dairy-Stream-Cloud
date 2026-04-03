import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      workbox: {
        // Avoid precaching every route chunk on first load.
        // The previous default Workbox behavior was pulling most built JS files
        // in the background, which is why the login page showed requests for
        // admin/customer/agent bundles in the network tab.
        globPatterns: ["**/*.{html,css,ico,png,svg,webmanifest}"],
        globIgnores: ["**/assets/dairyproduct-*.png"],
        cleanupOutdatedCaches: true,
      },
      manifest: {
        name: "DairyStream",
        short_name: "DairyStream",
        start_url: "/",
        display: "standalone",
      },
    }),
  ],

  server: {
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});

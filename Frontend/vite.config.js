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
        name: "DairyVision",
        short_name: "DairyVision",
        start_url: "/",
        display: "standalone",
        description: "Milk delivery management system for dairies, agents and customers",
        background_color: "#f8fafc",
        theme_color: "#2563eb",
        orientation: "portrait",
        icons: [
          {
            src: "/icons/icon-192.png?v=2",
            sizes: "192x192",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/icon-512.png?v=2",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
          {
            src: "/icons/apple-touch-icon.png?v=2",
            sizes: "180x180",
            type: "image/png",
          },
        ],
      },
    }),
  ],

  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "https://dairy-stream-cloud-backend.onrender.com",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

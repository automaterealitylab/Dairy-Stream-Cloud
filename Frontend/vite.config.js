import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "favicon-32x32.png", "apple-touch-icon.png"],
      workbox: {
        // Avoid precaching heavy assets on first load:
        // Product images and screenshots are excluded from precache and moved to runtime caching.
        globPatterns: ["**/*.{html,css,ico,png,svg,webmanifest}"],
        globIgnores: [
          "**/screenshots/**",
          "**/images/products/**",
          "**/assets/dairyproduct-*.png",
          "**/*.bak",
        ],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Runtime cache for product catalog images (e.g. /images/products/milk.png)
            urlPattern: /\/images\/products\/.*\.(?:png|jpg|jpeg|svg|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "product-images-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Runtime cache for dashboard screenshots (on-demand PWA preview)
            urlPattern: /\/screenshots\/.*\.(?:png|jpg|jpeg|webp)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "screenshots-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Runtime cache for Google Fonts stylesheets and webfonts
            urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            // Runtime cache for route JS chunks visited by users (enables offline agent navigation)
            urlPattern: /\/assets\/.*\.js$/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "app-js-chunks-cache",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
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

  test: {
    env: { NODE_ENV: "test" },
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{js,jsx}"],
  },
});

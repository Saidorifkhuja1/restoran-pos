import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "RestoPOS",
        short_name: "RestoPOS",
        display: "standalone",
        orientation: "landscape",
        start_url: "/",
        background_color: "#f8fafc",
        theme_color: "#0f766e",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/offline.html",
        runtimeCaching: [
          {
            urlPattern: /^\/api\/restaurants\/.*\/menu\/items/,
            handler: "NetworkFirst",
            options: { cacheName: "restopos-menu", expiration: { maxEntries: 80, maxAgeSeconds: 3600 } },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});

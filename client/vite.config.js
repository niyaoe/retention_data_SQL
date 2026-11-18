
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",

      // Enable PWA during localhost development
      devOptions: {
        enabled: true,
        type: "module",
      },

      manifest: {
        name: "Retention Data",
        short_name: "Retention",
        description: "Retention Data Management System",
        theme_color: "#ff5722",
        background_color: "#f2f2f2",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",

        icons: [
          {
            src: "/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg,woff2}",
        ],
      },
    }),
  ],
});

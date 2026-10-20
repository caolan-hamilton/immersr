import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// In production CloudFront serves the app and routes /api/* to the HTTP API (same origin, no CORS).
// Locally, set API_PROXY to your dev stack's CloudFront URL to get the same behaviour.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // main.tsx registers the worker itself: the generated registration reloads the page on update, which must never
      // happen mid-Session.
      injectRegister: false,
      manifest: {
        name: "Immersr",
        short_name: "Immersr",
        description: "Talk with Blob in the language you're learning. They speak it, you answer in English.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#fff7e8",
        theme_color: "#fff7e8",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // A new worker waits until every window is closed, so the new version takes over on the next launch and never
        // swaps the app out from under a live Session.
        skipWaiting: false,
        clientsClaim: false,
        // index.html is network-first at runtime, not precached.
        globPatterns: ["**/*.{js,css,png,svg,ico,woff,woff2}"],
        navigateFallback: null,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          { urlPattern: ({ url }) => url.pathname.startsWith("/api/"), handler: "NetworkOnly" },
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "shell-network-first",
              networkTimeoutSeconds: 4,
              plugins: [
                // Every navigation (deep links, the Cognito `/?code=…` redirect) shares one cached shell, so a cold
                // start offline at any URL finds it and one-time codes are never stored as separate entries.
                { cacheKeyWillBeUsed: async () => "/index.html" },
              ],
            },
          },
          {
            urlPattern: ({ url }) => url.pathname === "/config.json",
            handler: "NetworkFirst",
            options: { cacheName: "config-network-first", networkTimeoutSeconds: 4 },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "fonts" },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: process.env.API_PROXY ? { "/api": { target: process.env.API_PROXY, changeOrigin: true } } : undefined,
  },
});

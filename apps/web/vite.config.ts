import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// In production CloudFront serves the app and routes /api/* to the HTTP API (same origin, no CORS).
// Locally, set API_PROXY to your dev stack's CloudFront URL to get the same behaviour.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: process.env.API_PROXY ? { "/api": { target: process.env.API_PROXY, changeOrigin: true } } : undefined,
  },
});

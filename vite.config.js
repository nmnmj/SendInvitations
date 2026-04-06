import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      // Proxy any request starting with /api to our WhatsApp bridge
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});

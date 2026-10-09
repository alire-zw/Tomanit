import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = Number(env.PORT || 6543);
  const apiTarget = env.VITE_API_PROXY_TARGET || "http://localhost:2344";
  const allowedHosts = (
    env.VITE_ALLOWED_HOSTS ||
    "pnldevb.mirall.ir,paneloutdev.mirall.ir,localhost,127.0.0.1"
  )
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean);

  return {
    plugins: [react()],
    server: {
      port,
      strictPort: true,
      host: true,
      allowedHosts,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/pay": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port,
      strictPort: true,
      host: true,
      allowedHosts,
      proxy: {
        "/api": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/pay": {
          target: apiTarget,
          changeOrigin: true,
        },
      },
    },
  };
});

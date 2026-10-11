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
    build: {
      target: "es2022",
      cssCodeSplit: true,
      modulePreload: { polyfill: false },
      minify: "esbuild",
      reportCompressedSize: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;
            if (
              id.includes("react-dom") ||
              id.includes("react-router") ||
              id.includes("\\react\\") ||
              id.includes("/react/")
            ) {
              return "vendor-react";
            }
            if (id.includes("i18next") || id.includes("react-i18next")) {
              return "vendor-i18n";
            }
          },
        },
      },
    },
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

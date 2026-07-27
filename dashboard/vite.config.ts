import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const port = Number(process.env.PORT ?? 5000);
const basePath = process.env.BASE_PATH ?? "/";
const isReplit = !!process.env.REPL_ID;

export default defineConfig(async () => {
  const replitPlugins: any[] = [];

  if (isReplit && process.env.NODE_ENV !== "production") {
    try {
      const [{ default: runtimeErrorOverlay }, { cartographer }, { devBanner }] = await Promise.all([
        import("@replit/vite-plugin-runtime-error-modal"),
        import("@replit/vite-plugin-cartographer").then((m) => ({ cartographer: m.cartographer })),
        import("@replit/vite-plugin-dev-banner").then((m) => ({ devBanner: m.devBanner })),
      ]);
      replitPlugins.push(runtimeErrorOverlay(), cartographer(), devBanner());
    } catch {
      // plugins Replit non disponibles — ignorés
    }
  }

  return {
    base: basePath,
    plugins: [react(), tailwindcss(), ...replitPlugins],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      hmr: isReplit
        ? { clientPort: 443, protocol: "wss", host: process.env.REPLIT_DEV_DOMAIN }
        : true,
      fs: {
        strict: true,
      },
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
          configure: (proxy) => {
            proxy.on("error", (_err, _req, res) => {
              if ("writeHead" in res && typeof res.writeHead === "function") {
                res.writeHead(503, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "API server not ready yet, please retry." }));
              }
            });
          },
        },
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});

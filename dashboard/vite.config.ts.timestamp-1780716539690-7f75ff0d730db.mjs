// vite.config.ts
import { defineConfig } from "file:///home/runner/workspace/node_modules/.pnpm/vite@5.4.21_@types+node@22.19.19_lightningcss@1.32.0/node_modules/vite/dist/node/index.js";
import react from "file:///home/runner/workspace/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@5.4.21_@types+node@22.19.19_lightningcss@1.32.0_/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///home/runner/workspace/node_modules/.pnpm/@tailwindcss+vite@4.3.0_vite@5.4.21_@types+node@22.19.19_lightningcss@1.32.0_/node_modules/@tailwindcss/vite/dist/index.mjs";
import path from "path";
import runtimeErrorOverlay from "file:///home/runner/workspace/node_modules/.pnpm/@replit+vite-plugin-runtime-error-modal@0.0.3/node_modules/@replit/vite-plugin-runtime-error-modal/dist/index.mjs";
var __vite_injected_original_dirname = "/home/runner/workspace/dashboard";
var port = Number(process.env.PORT ?? 5e3);
var basePath = process.env.BASE_PATH ?? "/";
var vite_config_default = defineConfig({
  base: basePath,
  plugins: [
    react(),
    tailwindcss(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("file:///home/runner/workspace/node_modules/.pnpm/@replit+vite-plugin-cartographer@0.5.5/node_modules/@replit/vite-plugin-cartographer/dist/index.mjs").then(
        (m) => m.cartographer()
      ),
      await import("file:///home/runner/workspace/node_modules/.pnpm/@replit+vite-plugin-dev-banner@0.1.2/node_modules/@replit/vite-plugin-dev-banner/dist/index.mjs").then(
        (m) => m.devBanner()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "src")
    },
    dedupe: ["react", "react-dom"]
  },
  root: path.resolve(__vite_injected_original_dirname),
  build: {
    outDir: path.resolve(__vite_injected_original_dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    port,
    strictPort: true,
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path2) => path2.replace(/^\/api/, "")
      }
    }
  },
  preview: {
    port,
    host: "0.0.0.0",
    allowedHosts: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlL2Rhc2hib2FyZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL2hvbWUvcnVubmVyL3dvcmtzcGFjZS9kYXNoYm9hcmQvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL2hvbWUvcnVubmVyL3dvcmtzcGFjZS9kYXNoYm9hcmQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gXCJAdGFpbHdpbmRjc3Mvdml0ZVwiO1xuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcbmltcG9ydCBydW50aW1lRXJyb3JPdmVybGF5IGZyb20gXCJAcmVwbGl0L3ZpdGUtcGx1Z2luLXJ1bnRpbWUtZXJyb3ItbW9kYWxcIjtcblxuY29uc3QgcG9ydCA9IE51bWJlcihwcm9jZXNzLmVudi5QT1JUID8/IDUwMDApO1xuY29uc3QgYmFzZVBhdGggPSBwcm9jZXNzLmVudi5CQVNFX1BBVEggPz8gXCIvXCI7XG5cbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XG4gIGJhc2U6IGJhc2VQYXRoLFxuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICB0YWlsd2luZGNzcygpLFxuICAgIHJ1bnRpbWVFcnJvck92ZXJsYXkoKSxcbiAgICAuLi4ocHJvY2Vzcy5lbnYuTk9ERV9FTlYgIT09IFwicHJvZHVjdGlvblwiICYmXG4gICAgcHJvY2Vzcy5lbnYuUkVQTF9JRCAhPT0gdW5kZWZpbmVkXG4gICAgICA/IFtcbiAgICAgICAgICBhd2FpdCBpbXBvcnQoXCJAcmVwbGl0L3ZpdGUtcGx1Z2luLWNhcnRvZ3JhcGhlclwiKS50aGVuKChtKSA9PlxuICAgICAgICAgICAgbS5jYXJ0b2dyYXBoZXIoKSxcbiAgICAgICAgICApLFxuICAgICAgICAgIGF3YWl0IGltcG9ydChcIkByZXBsaXQvdml0ZS1wbHVnaW4tZGV2LWJhbm5lclwiKS50aGVuKChtKSA9PlxuICAgICAgICAgICAgbS5kZXZCYW5uZXIoKSxcbiAgICAgICAgICApLFxuICAgICAgICBdXG4gICAgICA6IFtdKSxcbiAgXSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICBcIkBcIjogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwic3JjXCIpLFxuICAgIH0sXG4gICAgZGVkdXBlOiBbXCJyZWFjdFwiLCBcInJlYWN0LWRvbVwiXSxcbiAgfSxcbiAgcm9vdDogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUpLFxuICBidWlsZDoge1xuICAgIG91dERpcjogcGF0aC5yZXNvbHZlKGltcG9ydC5tZXRhLmRpcm5hbWUsIFwiZGlzdC9wdWJsaWNcIiksXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXG4gIH0sXG4gIHNlcnZlcjoge1xuICAgIHBvcnQsXG4gICAgc3RyaWN0UG9ydDogdHJ1ZSxcbiAgICBob3N0OiBcIjAuMC4wLjBcIixcbiAgICBhbGxvd2VkSG9zdHM6IHRydWUsXG4gICAgZnM6IHtcbiAgICAgIHN0cmljdDogdHJ1ZSxcbiAgICB9LFxuICAgIHByb3h5OiB7XG4gICAgICBcIi9hcGlcIjoge1xuICAgICAgICB0YXJnZXQ6IFwiaHR0cDovL2xvY2FsaG9zdDozMDAwXCIsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgcmV3cml0ZTogKHBhdGgpID0+IHBhdGgucmVwbGFjZSgvXlxcL2FwaS8sIFwiXCIpLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxuICBwcmV2aWV3OiB7XG4gICAgcG9ydCxcbiAgICBob3N0OiBcIjAuMC4wLjBcIixcbiAgICBhbGxvd2VkSG9zdHM6IHRydWUsXG4gIH0sXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBa1IsU0FBUyxvQkFBb0I7QUFDL1MsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBQ3hCLE9BQU8sVUFBVTtBQUNqQixPQUFPLHlCQUF5QjtBQUpoQyxJQUFNLG1DQUFtQztBQU16QyxJQUFNLE9BQU8sT0FBTyxRQUFRLElBQUksUUFBUSxHQUFJO0FBQzVDLElBQU0sV0FBVyxRQUFRLElBQUksYUFBYTtBQUUxQyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixNQUFNO0FBQUEsRUFDTixTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixvQkFBb0I7QUFBQSxJQUNwQixHQUFJLFFBQVEsSUFBSSxhQUFhLGdCQUM3QixRQUFRLElBQUksWUFBWSxTQUNwQjtBQUFBLE1BQ0UsTUFBTSxPQUFPLHNKQUFrQyxFQUFFO0FBQUEsUUFBSyxDQUFDLE1BQ3JELEVBQUUsYUFBYTtBQUFBLE1BQ2pCO0FBQUEsTUFDQSxNQUFNLE9BQU8sa0pBQWdDLEVBQUU7QUFBQSxRQUFLLENBQUMsTUFDbkQsRUFBRSxVQUFVO0FBQUEsTUFDZDtBQUFBLElBQ0YsSUFDQSxDQUFDO0FBQUEsRUFDUDtBQUFBLEVBQ0EsU0FBUztBQUFBLElBQ1AsT0FBTztBQUFBLE1BQ0wsS0FBSyxLQUFLLFFBQVEsa0NBQXFCLEtBQUs7QUFBQSxJQUM5QztBQUFBLElBQ0EsUUFBUSxDQUFDLFNBQVMsV0FBVztBQUFBLEVBQy9CO0FBQUEsRUFDQSxNQUFNLEtBQUssUUFBUSxnQ0FBbUI7QUFBQSxFQUN0QyxPQUFPO0FBQUEsSUFDTCxRQUFRLEtBQUssUUFBUSxrQ0FBcUIsYUFBYTtBQUFBLElBQ3ZELGFBQWE7QUFBQSxFQUNmO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTjtBQUFBLElBQ0EsWUFBWTtBQUFBLElBQ1osTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLElBQ2QsSUFBSTtBQUFBLE1BQ0YsUUFBUTtBQUFBLElBQ1Y7QUFBQSxJQUNBLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFNBQVMsQ0FBQ0EsVUFBU0EsTUFBSyxRQUFRLFVBQVUsRUFBRTtBQUFBLE1BQzlDO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQO0FBQUEsSUFDQSxNQUFNO0FBQUEsSUFDTixjQUFjO0FBQUEsRUFDaEI7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJwYXRoIl0KfQo=

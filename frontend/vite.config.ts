import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env files based on `mode` (.env, .env.local, .env.[mode])
  // Only variables prefixed with VITE_ are exposed to client code.
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "VITE_");

  return {
    plugins: [react()],

    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },

    // ── Dev Server ─────────────────────────────────────────────
    server: {
      port: 5173,
      open: true,
      // Proxy API calls to local Hardhat node during development
      proxy: {
        "/rpc": {
          target: "http://127.0.0.1:8545",
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/rpc/, ""),
        },
      },
    },

    // ── Build ──────────────────────────────────────────────────
    build: {
      outDir: "dist",
      sourcemap: true,
      target: "es2020",
      rollupOptions: {
        output: {
          manualChunks: {
            ethers: ["ethers"],
            react: ["react", "react-dom"],
          },
        },
      },
    },

    // ── Env Prefix ─────────────────────────────────────────────
    // Only VITE_ prefixed variables are exposed to the browser.
    // This is a security boundary — server-side secrets like
    // PRIVATE_KEY are NEVER bundled into the frontend.
    envPrefix: "VITE_",
    // Load .env from the monorepo root (one level up)
    envDir: path.resolve(__dirname, ".."),

    // ── Define ─────────────────────────────────────────────────
    // Make env vars available at build time for type-safe access
    define: {
      __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "1.0.0"),
    },
  };
});

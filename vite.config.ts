import { resolve } from "node:path";
import { copyFileSync } from "node:fs";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const manifestBuildPlugin = () => ({
  name: "status-window-manifest-build",
  closeBundle() {
    copyFileSync(resolve(__dirname, "manifest.dist.json"), resolve(__dirname, "dist/manifest.json"));
  },
});

export default defineConfig({
  appType: "mpa",
  base: "./",
  plugins: [
    react(),
    manifestBuildPlugin(),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup.html"),
        sidepanel: resolve(__dirname, "sidepanel.html"),
        offscreen: resolve(__dirname, "offscreen.html"),
        background: resolve(__dirname, "src/background/serviceWorker.ts"),
      },
      output: {
        entryFileNames: (chunkInfo) =>
          chunkInfo.name === "background" ? "background.js" : "assets/[name].js",
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
        manualChunks: {
          react: ["react", "react-dom"],
          supabase: ["@supabase/supabase-js"],
        },
      },
    },
  },
});

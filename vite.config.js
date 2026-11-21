import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
  build: {
    outDir: "docs",
    rollupOptions: { output: { manualChunks: { phaser: ["phaser"] } } },
    chunkSizeWarningLimit: 1500,
  },
});

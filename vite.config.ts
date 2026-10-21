import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// One self-contained dist/index.html: no CDN, no external assets, opens from file://.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  server: { port: 3000 },
  preview: { port: 3000 },
  build: {
    cssCodeSplit: false,
    assetsInlineLimit: 100000000,
    target: "es2019",
    rollupOptions: {
      output: {
        format: "iife",
        inlineDynamicImports: true,
      },
    },
  },
});

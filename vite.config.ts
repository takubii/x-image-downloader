import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const inputPath = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig(({ mode }) => ({
  define: {
    __LOCAL_BUILD__: JSON.stringify(mode === "extension-local"),
  },
  publicDir: "public",
  build: {
    emptyOutDir: true,
    outDir: "dist",
    rolldownOptions: {
      input: {
        background: inputPath("src/background/service-worker.ts"),
        content: inputPath("src/content/content.ts"),
        xVideoPageObserver: inputPath("src/content/x-video-page-observer.ts"),
        popup: inputPath("src/popup/popup.html"),
        options: inputPath("src/options/options.html"),
        offscreen: inputPath("src/offscreen/offscreen.html"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "background") return "background.js";
          if (chunk.name === "content") return "content.js";
          if (chunk.name === "xVideoPageObserver") return "x-video-page-observer.js";
          return "assets/[name].js";
        },
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name][extname]",
      },
    },
  },
}));

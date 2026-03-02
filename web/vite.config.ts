import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const isGhPages = process.env.GITHUB_PAGES === "true";
const repo = process.env.GITHUB_REPOSITORY?.split("/")[1];
const base = isGhPages && repo ? `/${repo}/` : "/";
const rootDir = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base,
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(rootDir, "index.html"),
        starMap: path.resolve(rootDir, "star-map/index.html"),
      },
    },
  },
});

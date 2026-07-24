import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  outDir: "dist",
  splitting: false,
  sourcemap: false,
  clean: true,
  shims: true,
  // better-sqlite3 ships a native addon; keep it external so the addon is
  // resolved from node_modules at runtime instead of being bundled.
  external: ["better-sqlite3"],
  banner: {
    js: "#!/usr/bin/env node",
  },
});

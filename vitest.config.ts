import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globals: false,
    // SQLite singleton + BRAIN_FIGHT_DB_PATH must not race across files.
    fileParallelism: false,
  },
});

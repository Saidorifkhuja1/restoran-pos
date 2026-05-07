import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/web/src"),
    },
  },
  test: {
    globals: false,
    environmentMatchGlobs: [
      ["apps/web/src/**/*.test.tsx", "jsdom"],
      ["apps/server/**/*.test.ts", "node"],
      ["packages/**/*.test.ts", "node"],
    ],
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.ts"],
    setupFiles: ["./apps/web/src/test/setup.ts"],
  },
});

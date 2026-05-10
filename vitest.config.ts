import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/server"),
    },
  },
  test: {
    globals: false,
    environmentMatchGlobs: [
      ["apps/server/client/**/*.test.tsx", "jsdom"],
      ["apps/server/**/*.test.ts", "node"],
      ["packages/**/*.test.ts", "node"],
    ],
    include: ["apps/**/*.test.{ts,tsx}", "packages/**/*.test.ts"],
    setupFiles: ["./apps/server/client/test/setup.ts"],
  },
});

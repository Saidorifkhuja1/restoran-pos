import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  webServer: {
    command: "pnpm --filter @restopos/server dev",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: true,
  },
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://127.0.0.1:3001",
    trace: "on-first-retry",
  },
  projects: [
    { name: "tablet-pos", use: { ...devices["iPad Pro 11 landscape"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});

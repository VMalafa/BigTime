import { defineConfig } from "@playwright/test";

// Dedicated port so the smoke run never collides with a dev server on 3000.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  // One worker: the dev server's Prisma pool runs at connection_limit=1
  // (pgbouncer DATABASE_URL), so concurrent spec files starve the pool and
  // page renders die with P2024 timeouts.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    // System Chrome — no browser download needed on this machine.
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

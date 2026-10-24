import { defineConfig } from "@playwright/test";

// End-to-end tests run against a local production build by default
// (`npm run build` first), or against any deployment with E2E_BASE_URL.
// Viewer tests never need credentials, a database or the emulators.
const external = process.env.E2E_BASE_URL;
const port = 3220;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  // The signed-in (emulator) specs run against `next dev`, which recompiles a page it has evicted after
  // a quiet spell; give those runs more room. Normal runs use a production build.
  expect: { timeout: process.env.E2E_EMULATOR === "1" ? 30_000 : 10_000 },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 4,
  reporter: [["list"]],
  use: {
    baseURL: external ?? `http://127.0.0.1:${port}`,
    trace: "off",
  },
  webServer: external
    ? undefined
    : { command: `npx next start -p ${port}`, url: `http://127.0.0.1:${port}/viewer`, reuseExistingServer: true, timeout: 120_000 },
});

import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

// A fresh directory preserves both teammates' data and earlier failure evidence.
const stateDir =
  process.env.SCIEXCHANGE_E2E_STATE_DIR ??
  resolve(".cache", "live-e2e", randomUUID());
process.env.SCIEXCHANGE_E2E_STATE_DIR = stateDir;

export default defineConfig({
  testDir: "./e2e",
  testMatch: "live.spec.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  reporter: "list",
  // The mock suite clears test-results; keep concurrent live evidence separate.
  outputDir: ".cache/live-e2e-artifacts",
  use: {
    baseURL: "http://127.0.0.1:5174",
    actionTimeout: 15_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "live-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 1080 },
      },
    },
    {
      name: "live-mobile",
      use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" },
    },
  ],
  webServer: [
    {
      command: "../.venv/bin/python e2e/start_backend.py",
      url: "http://127.0.0.1:8766/health",
      reuseExistingServer: false,
      env: { SCIEXCHANGE_E2E_STATE_DIR: stateDir },
      timeout: 30_000,
    },
    {
      command:
        "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      reuseExistingServer: false,
      env: {
        VITE_DATA_MODE: "live",
        VITE_API_BASE_URL: "http://127.0.0.1:8766/api/v1",
        VITE_LAB_ID: "lab_synthesis",
      },
    },
  ],
});

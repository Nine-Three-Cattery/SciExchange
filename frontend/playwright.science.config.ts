import { defineConfig } from "@playwright/test";
import live from "./playwright.live.config";

export default defineConfig({
  ...live,
  testMatch: "science.spec.ts",
  outputDir: ".cache/science-e2e-artifacts",
  projects: live.projects?.filter(project => project.name === "live-desktop"),
  webServer: Array.isArray(live.webServer) ? live.webServer.map(server => ({
    ...server, env: { ...server.env, SCIEXCHANGE_E2E_SCIENCE: "1" },
  })) : live.webServer,
});

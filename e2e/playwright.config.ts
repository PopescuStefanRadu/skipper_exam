import { defineConfig, devices } from "@playwright/test";
import { stackEnv } from "./stack";

export default defineConfig({
  testDir: "./tests",
  // Tests never share mutable state, so every test can run in its own worker.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // scripts/test-run.sh sets TEST_RUN_DIR; the JSON results become part of the run's record.
  reporter: [
    ["list"],
    ...(process.env.TEST_RUN_DIR ? [["json", { outputFile: `${process.env.TEST_RUN_DIR}/e2e.json` }] as const] : []),
    ...(process.env.CI ? [["html", { open: "never" }] as const] : []),
  ],
  use: {
    baseURL: stackEnv().APP_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

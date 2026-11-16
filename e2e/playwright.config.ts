import { defineConfig, devices } from "@playwright/test";
import { stackEnv } from "./stack";

export default defineConfig({
  testDir: "./tests",
  // Tests never share mutable state, so every test can run in its own worker.
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  expect: { timeout: 5_000 },
  // scripts/test-run.sh sets TEST_RUN_DIR; the JSON results become part of the run's record.
  reporter: [
    ["list"],
    ...(process.env.TEST_RUN_DIR ? [["json", { outputFile: `${process.env.TEST_RUN_DIR}/e2e.json` }] as const] : []),
    ...(process.env.CI ? [["html", { open: "never" }] as const] : []),
  ],
  use: {
    baseURL: stackEnv().APP_URL,
    trace: "retain-on-failure",
    // Fail fast: in a local stack every action should take well under a second.
    actionTimeout: 5_000,
  },
  // Every test runs on both platforms. "android" is a phone in Chromium, the engine of
  // the Android WebView the app is packaged in.
  projects: [
    { name: "web", use: { ...devices["Desktop Chrome"] } },
    { name: "android", use: { ...devices["Pixel 7"] } },
  ],
});

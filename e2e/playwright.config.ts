import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The stack's actual address comes from .stack.env, written by scripts/stack.sh up.
function stackEnv(): Record<string, string> {
  const file = fileURLToPath(new URL("../.stack.env", import.meta.url));
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    throw new Error("No .stack.env: start this worktree's stack first (make up), or run make e2e.");
  }
  return Object.fromEntries(
    text
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1)]),
  );
}

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

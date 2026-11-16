import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// The stack's actual addresses, written by scripts/stack.sh up.
export function stackEnv(): Record<string, string> {
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

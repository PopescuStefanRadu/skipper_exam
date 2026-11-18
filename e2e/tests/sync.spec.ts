// Offline and sync on the web (docs/app/features/offline-and-sync.md). The Android
// app's offline scenarios run on an emulator (e2e/android/).
import { expect, test } from "@playwright/test";
import { answer, contentPackage, createAccount, setExamType, signIn } from "./helpers";

test("answers made while the server is unreachable wait on the device, then sync", async ({ page }) => {
  await page.clock.install();
  const pkg = await contentPackage(page);
  await signIn(page, await createAccount());
  await expect(page).toHaveURL("/tip-examen");
  await setExamType(page, "C-diff");

  await page.route("**/api/events", (route) => route.abort("connectionrefused"));
  await page.goto("/");
  await page.getByRole("button", { name: "Începe examenul" }).click();
  await answer(page, pkg, true);
  await expect(page.getByTestId("sync-status")).toHaveText("2 modificări așteaptă conexiunea cu serverul.");

  // The server is back: waiting events are retried without any new activity.
  await page.unroute("**/api/events");
  await page.clock.fastForward(16_000);
  await expect(page.getByTestId("sync-status")).toHaveText("Toate datele sunt salvate pe server.");
  const events: { type: string }[] = await (await page.request.get("/api/events")).json();
  // The page clock is frozen, so both events can have the same time; their order then isn't fixed.
  expect(events.map((e) => e.type).sort()).toEqual(["exam.answered", "exam.started"]);
});

test("a signed-in user's app opens while the server is unreachable", async ({ page }) => {
  await signIn(page, await createAccount());
  await expect(page).toHaveURL("/tip-examen");
  await setExamType(page, "C");
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Începe examenul" })).toBeVisible();

  await page.route("**/api/**", (route) => route.abort("connectionrefused"));
  await page.route("**/.ory/**", (route) => route.abort("connectionrefused"));
  await page.reload();
  await expect(page.getByTestId("exam-type")).toHaveText("Clasa C");
  await page.getByRole("button", { name: "Începe examenul" }).click();
  await expect(page.getByText("Întrebarea 1 din 40")).toBeVisible();
});

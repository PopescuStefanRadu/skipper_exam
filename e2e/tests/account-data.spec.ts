// Exporting your data and deleting your account (docs/app/features/accounts.md).
import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setExamType, signIn, uniqueEmail } from "./helpers";

// Records a practice answer through the API, as the app would after a sync.
async function recordAnswer(page: Page): Promise<string> {
  const id = randomUUID();
  const res = await page.request.post("/api/events", {
    data: {
      events: [
        {
          id,
          type: "practice.answered",
          at: new Date().toISOString(),
          data: { questionId: "q-test", answer: "a", correct: true, mode: "learn" },
        },
      ],
    },
  });
  expect(res.ok()).toBeTruthy();
  return id;
}

async function signedInWithProgress(page: Page): Promise<{ email: string; eventId: string }> {
  const email = uniqueEmail();
  await signIn(page, email);
  await expect(page).toHaveURL("/tip-examen");
  await setExamType(page, "C");
  const eventId = await recordAnswer(page);
  return { email, eventId };
}

test("the export contains the account, the profile and all progress", async ({ page }) => {
  const { email, eventId } = await signedInWithProgress(page);
  await page.goto("/");
  await page.getByRole("link", { name: "Contul meu" }).click();
  await expect(page).toHaveURL("/cont");

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descarcă datele mele" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("examen-caa-date.json");
  const data = JSON.parse(await readFile(await file.path(), "utf8"));
  expect(data.account.email).toBe(email);
  expect(data.profile.examTypes).toEqual(["C"]);
  expect(data.roles).toEqual([]);
  expect(data.events.map((e: { id: string }) => e.id)).toEqual([eventId]);
});

test("deleting the account removes it and all its progress", async ({ page }) => {
  const { email } = await signedInWithProgress(page);
  const id = (await (await page.request.get("/api/me")).json()).id;
  await page.goto("/cont");
  await page.getByRole("button", { name: "Șterge contul" }).click();
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "Șterge definitiv" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Scrie emailul contului pentru confirmare").fill("altcineva@example.test");
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Scrie emailul contului pentru confirmare").fill(email);
  await confirm.click();

  await expect(page).toHaveURL("/autentificare");
  await expect(page.getByText("Contul tău a fost șters.")).toBeVisible();
  expect((await page.request.get("/api/me")).status()).toBe(401);
  const deletedId = id;

  // Signing in again with the same identity starts from nothing.
  await signIn(page, email);
  await expect(page).toHaveURL("/tip-examen");
  expect((await (await page.request.get("/api/me")).json()).id).not.toBe(deletedId);
  expect(await (await page.request.get("/api/events")).json()).toEqual([]);
  expect((await (await page.request.get("/api/profile")).json()).examTypes).toEqual([]);
});

test("cancelling the deletion keeps the account", async ({ page }) => {
  const { email } = await signedInWithProgress(page);
  await page.goto("/cont");
  await page.getByRole("button", { name: "Șterge contul" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Back" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.goto("/");
  await expect(page.getByTestId("signed-in-email")).toHaveText(email);
  expect(await (await page.request.get("/api/events")).json()).toHaveLength(1);
});

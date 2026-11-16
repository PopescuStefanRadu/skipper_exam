// The screenshot tour: every screen and state, on every platform, saved for visual
// inspection (see "Platforms and screenshots" in docs/DEVELOPMENT.md). Each step
// checks that the screen is the expected one before capturing it.
import { expect, test, type Page } from "@playwright/test";
import {
  answer,
  contentPackage,
  createAccount,
  setExamType,
  signIn,
  signUp,
  startExam,
  uniqueEmail,
} from "./helpers";
import { recoveryCode } from "./mail";

async function screenshot(page: Page, name: string) {
  const info = test.info();
  const dir = process.env.TEST_RUN_DIR ?? info.outputDir;
  // Wait for fonts and pending renders, so the image shows the settled screen.
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${dir}/screenshots/${info.project.name}/${name}.png`, fullPage: true, animations: "disabled" });
}

test("signed-out screens", async ({ page }) => {
  await page.goto("/autentificare");
  await expect(page.getByTestId("server-status")).toHaveAttribute("data-state", "ok");
  await screenshot(page, "01-sign-in");

  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Parolă").fill("o-parola-gresita-1");
  await page.getByRole("button", { name: "Intră în cont" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await screenshot(page, "02-sign-in-refused");

  await page.goto("/inregistrare");
  await page.getByLabel("Email").fill(uniqueEmail());
  await page.getByLabel("Parolă").fill("scurt");
  await page.getByRole("button", { name: "Creează contul" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await screenshot(page, "03-sign-up-refused");
});

test("password recovery screens", async ({ page }) => {
  const email = await createAccount();
  await page.goto("/recuperare");
  await screenshot(page, "04-recovery");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Trimite codul" }).click();
  await expect(page.getByLabel("Cod")).toBeVisible();
  await screenshot(page, "05-recovery-code");
  await page.getByLabel("Cod").fill(await recoveryCode(email));
  await page.getByRole("button", { name: "Confirmă codul" }).click();
  await expect(page.getByRole("heading", { name: "Parolă nouă" })).toBeVisible();
  await screenshot(page, "06-new-password");
});

test("server unavailable", async ({ page }) => {
  await page.route("**/api/health", (route) => route.abort("connectionrefused"));
  await page.goto("/autentificare");
  await expect(page.getByTestId("server-status")).toHaveAttribute("data-state", "unavailable");
  await screenshot(page, "07-server-unavailable");
});

test("exam type and home", async ({ page }) => {
  await signUp(page, uniqueEmail());
  await expect(page.getByRole("heading", { name: "Pentru ce examen te pregătești?" })).toBeVisible();
  await screenshot(page, "08-exam-type");
  await page.getByLabel("Clasa D", { exact: true }).check();
  await page.getByRole("button", { name: "Salvează" }).click();
  await expect(page.getByRole("button", { name: "Începe examenul" })).toBeVisible();
  await screenshot(page, "09-home");
});

test("exam screens and a failed result", async ({ page }) => {
  const pkg = await contentPackage(page);
  await startExam(page, "C");
  await expect(page.getByText("Întrebarea 1 din 40")).toBeVisible();
  await screenshot(page, "10-exam-question");
  await answer(page, pkg, false);
  await screenshot(page, "11-exam-question-answered");
  await page.getByRole("button", { name: "Next" }).click();
  await answer(page, pkg, true);

  await page.goto("/");
  await expect(page.getByText("Ai un examen neterminat.")).toBeVisible();
  await screenshot(page, "12-home-unfinished-exam");
  await page.getByRole("button", { name: "Continuă examenul" }).click();

  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await screenshot(page, "13-exam-confirm-submit");
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("heading", { name: "Respins" })).toBeVisible();
  await screenshot(page, "14-result-failed");
});

test("a passed result", async ({ page }) => {
  const pkg = await contentPackage(page);
  await startExam(page, "D-diff");
  for (let i = 1; i <= 20; i++) {
    await answer(page, pkg, true);
    if (i < 20) await page.getByRole("button", { name: "Next" }).click();
  }
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
  await screenshot(page, "15-exam-last-question");
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("heading", { name: "Admis" })).toBeVisible();
  await screenshot(page, "16-result-passed");
});

test("time ran out", async ({ page }) => {
  await page.clock.install();
  const pkg = await contentPackage(page);
  await signIn(page, await createAccount());
  await expect(page).toHaveURL("/tip-examen");
  await setExamType(page, "D-diff");
  await page.goto("/");
  await page.getByRole("button", { name: "Începe examenul" }).click();
  await answer(page, pkg, true);
  await page.goto("about:blank");
  await page.clock.fastForward("31:00");
  await page.goto("/");
  await expect(page.getByText("Timpul examenului neterminat a expirat.")).toBeVisible();
  await screenshot(page, "17-home-exam-expired");
  await page.getByRole("link", { name: "Vezi rezultatul" }).click();
  await expect(page.getByText("Timpul a expirat.")).toBeVisible();
  await screenshot(page, "18-result-timed-out");
});

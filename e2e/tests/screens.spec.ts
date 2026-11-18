// The screenshot tour: every screen and state, on every platform, saved for visual
// inspection (see "Platforms and screenshots" in docs/DEVELOPMENT.md). Each step
// checks that the screen is the expected one before capturing it.
import { expect, test, type Page } from "@playwright/test";
import {
  answer,
  contentPackage,
  setExamType,
  signIn,
  startExam,
  uniqueEmail,
} from "./helpers";
import { createReviewer, explanations } from "./review";

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

  await page.goto("/auth/callback?error=access_denied&state=x");
  await expect(page.getByRole("alert")).toBeVisible();
  await screenshot(page, "02-sign-in-failed");
});

test("server unavailable", async ({ page }) => {
  await page.route("**/api/health", (route) => route.abort("connectionrefused"));
  await page.goto("/autentificare");
  await expect(page.getByTestId("server-status")).toHaveAttribute("data-state", "unavailable");
  await screenshot(page, "07-server-unavailable");
});

test("exam type and home", async ({ page }) => {
  await signIn(page, uniqueEmail());
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
  await signIn(page);
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

test("explanations", async ({ page }) => {
  const pkg = await contentPackage(page);
  await signIn(page);
  await expect(page).toHaveURL("/tip-examen");
  const all = await explanations(page);
  const e = all.find((e) => e.status === "suggested" && e.source.startsWith("colreg"))!;
  await page.goto(`/intrebare/${e.questionId}`);
  await expect(page.getByTestId("quote")).toBeVisible();
  await screenshot(page, "19-explanation");

  const explained = new Set(all.map((e) => e.questionId));
  await page.goto(`/intrebare/${pkg.questions.find((q) => !explained.has(q.id))!.id}`);
  await expect(page.getByText("Nu există încă o explicație pentru această întrebare.")).toBeVisible();
  await screenshot(page, "20-no-explanation");
});

test("reviewer view", async ({ page }) => {
  await createReviewer(page);
  await expect(page).toHaveURL("/tip-examen");
  const e = (await explanations(page)).find((e) => e.status === "suggested" && e.source.startsWith("colreg"))!;
  await page.goto(`/intrebare/${e.questionId}`);
  await expect(page.getByRole("button", { name: "Confirmă" })).toBeVisible();
  await screenshot(page, "21-explanation-reviewer");
  await page.getByRole("button", { name: "Corectează" }).click();
  await expect(page.getByLabel("Citatul")).toBeVisible();
  await screenshot(page, "22-correction-form");
});

test("learning", async ({ page }) => {
  const pkg = await contentPackage(page);
  await signIn(page);
  await expect(page).toHaveURL("/tip-examen");
  await setExamType(page, "C");
  await page.goto("/invatare/greseli");
  await expect(page.getByText("Nu ai greșeli de recapitulat.")).toBeVisible();
  await screenshot(page, "23-no-mistakes");

  await page.goto("/invatare/colreg");
  await expect(page.getByTestId("question")).toBeVisible();
  await screenshot(page, "24-learning-question");
  await answer(page, pkg, false);
  await expect(page.getByTestId("feedback")).toBeVisible();
  await screenshot(page, "25-learning-wrong");
  await page.getByRole("button", { name: "Next" }).click();
  await answer(page, pkg, true);
  await expect(page.getByTestId("feedback")).toHaveText("Corect!");
  await screenshot(page, "26-learning-right");
  for (let i = 0; i < 4; i++) {
    await page.getByRole("button", { name: "Next" }).click();
    await answer(page, pkg, false);
  }

  await page.goto("/invatare");
  await expect(page.getByText("Punct slab")).toBeVisible();
  await screenshot(page, "27-learning-page");

  await page.getByRole("link", { name: "Practică greșelile" }).click();
  for (let i = 0; i < 5; i++) {
    await answer(page, pkg, true);
    await page.getByRole("button", { name: "Next" }).click();
  }
  await expect(page.getByTestId("session-score")).toBeVisible();
  await screenshot(page, "28-mistakes-done");
});

test("dark mode", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const pkg = await contentPackage(page);
  await page.goto("/autentificare");
  await expect(page.getByTestId("server-status")).toHaveAttribute("data-state", "ok");
  await screenshot(page, "29-dark-sign-in");
  await startExam(page, "C");
  await answer(page, pkg, true);
  await screenshot(page, "30-dark-exam-question");
  await page.goto("/");
  await expect(page.getByText("Ai un examen neterminat.")).toBeVisible();
  await screenshot(page, "31-dark-home");
  await page.goto("/invatare/colreg");
  await answer(page, pkg, false);
  await expect(page.getByTestId("feedback")).toBeVisible();
  await screenshot(page, "32-dark-learning-wrong");
});

test("account page", async ({ page }) => {
  const email = uniqueEmail();
  await signIn(page, email);
  await expect(page).toHaveURL("/tip-examen");
  await setExamType(page, "C");
  await page.goto("/cont");
  await expect(page.getByRole("button", { name: "Șterge contul" })).toBeVisible();
  await screenshot(page, "33-account");
  await page.getByRole("button", { name: "Șterge contul" }).click();
  await page.getByLabel("Scrie emailul contului pentru confirmare").fill(email);
  await screenshot(page, "34-account-delete-confirm");
  await page.getByRole("button", { name: "Șterge definitiv" }).click();
  await expect(page.getByText("Contul tău a fost șters.")).toBeVisible();
  await screenshot(page, "35-account-deleted");
});

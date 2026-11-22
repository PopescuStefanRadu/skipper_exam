// History and statistics (docs/app/features/statistics.md).
import { expect, test, type Page } from "@playwright/test";
import { answer, contentPackage, recordExam, setExamType, signIn } from "./helpers";

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

async function signInWith(page: Page, ...examTypes: string[]) {
  await signIn(page);
  await expect(page).toHaveURL("/tip-examen");
  await setExamType(page, ...examTypes);
}

test("the history lists past exams, newest first, with the summary", async ({ page }) => {
  const pkg = await contentPackage(page);
  await signInWith(page, "D");
  const failed = await recordExam(page, pkg, { examType: "D", correct: 20, start: daysAgo(2), minutes: 30 });
  const passed = await recordExam(page, pkg, { examType: "D", correct: 36, start: daysAgo(1), minutes: 25 });

  await page.goto("/");
  await page.getByRole("link", { name: "Istoric și statistici" }).click();
  await expect(page).toHaveURL("/progres");

  await expect(page.getByTestId("stat-exams")).toHaveText("2");
  await expect(page.getByTestId("stat-passed")).toHaveText("1 (50%)");
  await expect(page.getByTestId("stat-average")).toHaveText("70%");
  await expect(page.getByTestId("stat-best")).toHaveText("90%");
  await expect(page.getByTestId("score-bar")).toHaveCount(2);

  const rows = page.getByTestId("attempt");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute("data-exam-id", passed);
  await expect(rows.nth(0)).toContainText("36 din 40 (90%)");
  await expect(rows.nth(0)).toContainText("Admis");
  await expect(rows.nth(0)).toContainText("25 min");
  await expect(rows.nth(1)).toHaveAttribute("data-exam-id", failed);
  await expect(rows.nth(1)).toContainText("20 din 40 (50%)");
  await expect(rows.nth(1)).toContainText("Respins");

  await rows.nth(1).getByRole("link", { name: "Vezi rezultatul" }).click();
  await expect(page).toHaveURL(`/examen/${failed}/rezultat`);
  await expect(page.getByRole("heading", { name: "Respins" })).toBeVisible();
});

test("practice answers show in the practice activity, with the days in a row", async ({ page }) => {
  const pkg = await contentPackage(page);
  await signInWith(page, "C-diff");
  await page.goto("/invatare/colreg");
  await answer(page, pkg, true);
  await page.getByRole("button", { name: "Next" }).click();
  await answer(page, pkg, false);
  await page.getByRole("button", { name: "Next" }).click();
  await answer(page, pkg, true);

  await page.goto("/progres");
  await expect(page.getByTestId("stat-practice")).toHaveText("3");
  await expect(page.getByTestId("stat-practice-right")).toHaveText("2 (67%)");
  await expect(page.getByTestId("stat-streak")).toHaveText("1");
  await expect(page.getByTestId("activity-bar")).toHaveCount(14);
});

test("with no exams yet, the page offers to start one", async ({ page }) => {
  await signInWith(page, "C");
  await page.goto("/progres");
  await expect(page.getByText("Nu ai dat încă niciun examen simulat.")).toBeVisible();
  await page.getByRole("link", { name: "Începe un examen" }).click();
  await expect(page).toHaveURL("/");
});

test("an abandoned exam is listed without a score and doesn't count", async ({ page }) => {
  const pkg = await contentPackage(page);
  await signInWith(page, "D");
  await recordExam(page, pkg, { examType: "D", correct: 40, start: daysAgo(3) });
  await recordExam(page, pkg, { examType: "D", correct: 5, start: daysAgo(1), abandon: true });
  await page.goto("/progres");
  await expect(page.getByTestId("stat-exams")).toHaveText("1");
  const rows = page.getByTestId("attempt");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("Abandonat");
  await expect(rows.nth(0).getByRole("link", { name: "Vezi rezultatul" })).toHaveCount(0);
});

test("with several exam types, the filter shows one type's exams", async ({ page }) => {
  const pkg = await contentPackage(page);
  await signInWith(page, "C", "D");
  await recordExam(page, pkg, { examType: "C", correct: 40, start: daysAgo(2) });
  await recordExam(page, pkg, { examType: "D", correct: 20, start: daysAgo(1) });
  await page.goto("/progres");
  await expect(page.getByTestId("attempt")).toHaveCount(2);
  await page.getByLabel("Examen").selectOption({ label: "Clasa D" });
  await expect(page.getByTestId("attempt")).toHaveCount(1);
  await expect(page.getByTestId("attempt")).toContainText("Clasa D");
  await expect(page.getByTestId("stat-exams")).toHaveText("1");
  await expect(page.getByTestId("stat-best")).toHaveText("50%");
});

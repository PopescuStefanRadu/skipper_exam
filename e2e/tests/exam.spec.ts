import { expect, test, type Page } from "@playwright/test";
import {
  answer,
  contentPackage,
  currentQuestion,
  expectQuestionNumber,
  signIn,
  startExam,
  createAccount,
  setExamType,
  type ContentPackage,
} from "./helpers";

// Answers questions from the current one up to the last one, moving on with Next.
async function answerAll(page: Page, pkg: ContentPackage, total: number, wrong = 0) {
  for (let i = 1; i <= total; i++) {
    await expectQuestionNumber(page, i, total);
    await answer(page, pkg, i > wrong);
    if (i < total) await page.getByRole("button", { name: "Next" }).click();
  }
}

test("answering everything correctly passes the exam", async ({ page }) => {
  const pkg = await contentPackage(page);
  await signIn(page, await createAccount());
  await expect(page).toHaveURL("/tip-examen");
  await setExamType(page, "D");
  await page.goto("/");
  await expect(page.getByText("40 de întrebări, 45 de minute, promovare de la 80%")).toBeVisible();
  await expect(page.getByText("Formatul examenului nu este confirmat oficial.")).toBeVisible();
  await page.getByRole("button", { name: "Începe examenul" }).click();

  await expect(page.getByText("Formatul examenului nu este confirmat oficial.")).toBeVisible();
  await expect(page.getByTestId("time-left")).toHaveText(/^4[45]:\d\d$/);
  await answerAll(page, pkg, 40);
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page).toHaveURL(/\/examen\/[0-9a-f-]+\/rezultat$/);
  await expect(page.getByRole("heading", { name: "Admis" })).toBeVisible();
  await expect(page.getByText("40 din 40 de răspunsuri corecte (100%). Pragul de promovare este 80%.")).toBeVisible();
  await expect(page.getByTestId("wrong-answer")).toHaveCount(0);
});

test("wrong answers fail the exam and are listed with the correct answer", async ({ page }) => {
  const pkg = await contentPackage(page);
  await startExam(page, "C");
  const given: Record<string, string> = {};
  for (let i = 1; i <= 40; i++) {
    const q = await currentQuestion(page, pkg);
    given[q.id] = await answer(page, pkg, i > 10);
    if (i < 40) await page.getByRole("button", { name: "Next" }).click();
  }
  // Answers can be changed until the exam is submitted.
  await page.getByRole("button", { name: "Previous" }).click();
  await expectQuestionNumber(page, 39, 40);
  await page.getByRole("button", { name: "Next" }).click();
  await page.getByRole("button", { name: "Submit" }).click();

  await expect(page.getByRole("heading", { name: "Respins" })).toBeVisible();
  await expect(page.getByText("30 din 40 de răspunsuri corecte (75%). Pragul de promovare este 80%.")).toBeVisible();
  const wrong = page.getByTestId("wrong-answer");
  await expect(wrong).toHaveCount(10);
  for (const item of await wrong.all()) {
    const id = await item.getAttribute("data-question-id");
    const question = pkg.questions.find((q) => q.id === id)!;
    await expect(item.getByTestId("given")).toHaveText(given[question.id]);
    await expect(item.getByTestId("correct")).toHaveText(question.answers.find((a) => a.correct)!.text);
  }
});

test("an exam has only the exam type's questions, without repeats or equivalent pairs", async ({ page }) => {
  const pkg = await contentPackage(page);
  await startExam(page, "C-diff");
  const allowed = new Set(pkg.examTypes.find((t) => t.id === "C-diff")!.questionIds);
  const ids = new Set<string>();
  const groups = new Set<string>();
  for (let i = 1; i <= 20; i++) {
    await expectQuestionNumber(page, i, 20);
    const q = await currentQuestion(page, pkg);
    expect(allowed.has(q.id)).toBeTruthy();
    expect(q.subject).toBe("colreg");
    expect(ids.has(q.id)).toBeFalsy();
    ids.add(q.id);
    if (q.group) {
      expect(groups.has(q.group)).toBeFalsy();
      groups.add(q.group);
    }
    if (i < 20) await page.getByRole("button", { name: "Next" }).click();
  }
  await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
});

test("when the time runs out the exam is submitted, unanswered questions counting as wrong", async ({ page }) => {
  await page.clock.install();
  const pkg = await contentPackage(page);
  await startExam(page, "D-diff");
  for (let i = 1; i <= 3; i++) {
    await answer(page, pkg, true);
    await page.getByRole("button", { name: "Next" }).click();
  }
  await page.clock.fastForward("30:01");

  await expect(page).toHaveURL(/\/rezultat$/);
  await expect(page.getByText("Timpul a expirat.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Respins" })).toBeVisible();
  await expect(page.getByText("3 din 20 de răspunsuri corecte (15%).", { exact: false })).toBeVisible();
  await expect(page.getByTestId("wrong-answer")).toHaveCount(17);
  await expect(page.getByTestId("given").first()).toHaveText("Fără răspuns");
});

test("submitting with unanswered questions asks for confirmation", async ({ page }) => {
  const pkg = await contentPackage(page);
  await startExam(page, "D-diff");
  await answer(page, pkg, true);
  await page.getByRole("button", { name: "Submit" }).click();
  await expect(page.getByText("Ai 19 întrebări fără răspuns. Acestea vor fi considerate greșite.")).toBeVisible();
  await page.getByRole("button", { name: "Back" }).click();
  await expectQuestionNumber(page, 1, 20);

  await page.getByRole("button", { name: "Submit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("heading", { name: "Respins" })).toBeVisible();
  await expect(page.getByTestId("wrong-answer")).toHaveCount(19);
});

test("an exam left halfway can be resumed with its answers", async ({ page }) => {
  const pkg = await contentPackage(page);
  await startExam(page, "D");
  const first = await answer(page, pkg, true);
  await page.getByRole("button", { name: "Next" }).click();
  await answer(page, pkg, false);

  await page.goto("/");
  await expect(page.getByText("Ai un examen neterminat.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Începe examenul" })).toHaveCount(0);
  await page.getByRole("button", { name: "Continuă examenul" }).click();
  await expectQuestionNumber(page, 1, 40);
  await expect(page.getByRole("radio", { name: first, exact: true })).toBeChecked();
});

test("an exam left halfway can be abandoned", async ({ page }) => {
  const pkg = await contentPackage(page);
  await startExam(page, "D");
  await answer(page, pkg, true);
  await page.goto("/");
  await page.getByRole("button", { name: "Renunță la examen" }).click();
  await expect(page.getByText("Ai un examen neterminat.")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Începe examenul" })).toBeVisible();
  await page.goto("/examen");
  await expect(page).toHaveURL("/");
});

test("coming back after the exam's time ran out shows its result", async ({ page }) => {
  await page.clock.install();
  const pkg = await contentPackage(page);
  await startExam(page, "D-diff");
  await answer(page, pkg, true);
  // Leave the app, and come back after the time limit.
  await page.goto("about:blank");
  await page.clock.fastForward("31:00");
  await page.goto("/");
  await expect(page.getByText("Timpul examenului neterminat a expirat.")).toBeVisible();
  await page.getByRole("link", { name: "Vezi rezultatul" }).click();
  await expect(page.getByRole("heading", { name: "Respins" })).toBeVisible();
  await expect(page.getByText("1 din 20 de răspunsuri corecte (5%).", { exact: false })).toBeVisible();
});

test("an exam started on one device can be resumed on another", async ({ browser }) => {
  const email = await createAccount();
  const one = await (await browser.newContext()).newPage();
  const pkg = await contentPackage(one);
  await signIn(one, email);
  await expect(one).toHaveURL("/tip-examen");
  await setExamType(one, "C");
  await one.goto("/");
  await one.getByRole("button", { name: "Începe examenul" }).click();
  const chosen = await answer(one, pkg, true);
  const id = await one.getByTestId("question").getAttribute("data-question-id");
  await expect
    .poll(async () => {
      const events: { type: string }[] = await (await one.request.get("/api/events")).json();
      return events.filter((e) => e.type === "exam.answered").length;
    })
    .toBe(1);

  const other = await (await browser.newContext()).newPage();
  await signIn(other, email);
  await other.getByRole("button", { name: "Continuă examenul" }).click();
  await expectQuestionNumber(other, 1, 40);
  await expect(other.getByTestId("question")).toHaveAttribute("data-question-id", id!);
  await expect(other.getByRole("radio", { name: chosen, exact: true })).toBeChecked();
});

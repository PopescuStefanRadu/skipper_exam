// Learning mode, "practice my mistakes" and coverage (docs/app/features/learning-and-review.md).
import { expect, test, type Page } from "@playwright/test";
import {
  answer,
  contentPackage,
  createAccount,
  currentQuestion,
  setExamType,
  signIn,
  startExam,
  type ContentPackage,
} from "./helpers";

// Signs in a new account with the given exam type.
async function signInWith(page: Page, examType: string) {
  await signIn(page, await createAccount());
  await expect(page).toHaveURL("/tip-examen");
  await setExamType(page, examType);
}

// The questions a learning session for the subject goes through, in order: the exam
// type's questions of that subject, one per group of equivalent questions.
function subjectOrder(pkg: ContentPackage, examType: string, subject: string): string[] {
  const byId = new Map(pkg.questions.map((q) => [q.id, q]));
  const groups = new Set<string>();
  const ids: string[] = [];
  for (const id of pkg.examTypes.find((t) => t.id === examType)!.questionIds!) {
    const q = byId.get(id)!;
    if (q.subject !== subject || groups.has(q.group ?? q.id)) continue;
    groups.add(q.group ?? q.id);
    ids.push(id);
  }
  return ids;
}

async function shownId(page: Page): Promise<string> {
  return (await page.getByTestId("question").getAttribute("data-question-id"))!;
}

function subjectRow(page: Page, subject: string) {
  return page.locator(`[data-testid="subject"][data-subject="${subject}"]`);
}

async function expectCounts(page: Page, subject: string, seen: string, mastered: number, mistakes: number) {
  const row = subjectRow(page, subject);
  await expect(row.getByTestId("seen")).toHaveText(seen);
  await expect(row.getByTestId("mastered")).toHaveText(String(mastered));
  await expect(row.getByTestId("mistakes")).toHaveText(String(mistakes));
}

test("learning mode gives immediate feedback and the explanation", async ({ page }) => {
  const pkg = await contentPackage(page);
  await signInWith(page, "C-diff");
  await page.goto("/");
  await page.getByRole("link", { name: "Învățare" }).click();
  await expect(page).toHaveURL("/invatare");
  await subjectRow(page, "colreg").getByRole("link", { name: "Învață" }).click();
  await expect(page).toHaveURL("/invatare/colreg");

  const order = subjectOrder(pkg, "C-diff", "colreg");
  await expect(page.getByText(`Întrebarea 1 din ${order.length}`)).toBeVisible();
  const q = await currentQuestion(page, pkg);
  expect(q.id).toBe(order[0]);
  await expect(page.getByRole("button", { name: "Next" })).toHaveCount(0);

  await answer(page, pkg, false);
  await expect(page.getByTestId("feedback")).toHaveText("Greșit.");
  await expect(page.getByTestId("correct")).toHaveText(q.answers.find((a) => a.correct)!.text);
  await expect(page.getByRole("heading", { name: "De ce" })).toBeVisible();
  // The answer can't be changed once given.
  for (const radio of await page.getByRole("radio").all()) await expect(radio).toBeDisabled();

  await page.getByRole("button", { name: "Next" }).click();
  await expect(page.getByText(`Întrebarea 2 din ${order.length}`)).toBeVisible();
  expect(await shownId(page)).toBe(order[1]);
  await answer(page, pkg, true);
  await expect(page.getByTestId("feedback")).toHaveText("Corect!");
});

test("a learning session continues from the first question not seen yet", async ({ page }) => {
  const pkg = await contentPackage(page);
  await signInWith(page, "C-diff");
  const order = subjectOrder(pkg, "C-diff", "colreg");
  await page.goto("/invatare/colreg");
  await answer(page, pkg, true);
  await page.getByRole("button", { name: "Next" }).click();
  await answer(page, pkg, false);

  await page.goto("/invatare");
  await subjectRow(page, "colreg").getByRole("link", { name: "Învață" }).click();
  await expect(page.getByText(`Întrebarea 3 din ${order.length}`)).toBeVisible();
  expect(await shownId(page)).toBe(order[2]);
});

test("with no mistakes, practice my mistakes has nothing to review", async ({ page }) => {
  await signInWith(page, "C-diff");
  await page.goto("/invatare");
  await page.getByRole("link", { name: "Practică greșelile" }).click();
  await expect(page).toHaveURL("/invatare/greseli");
  await expect(page.getByText("Nu ai greșeli de recapitulat.")).toBeVisible();
  await expect(page.getByTestId("question")).toHaveCount(0);
});

test("practice my mistakes has exactly the questions answered wrong, in exams and in learning", async ({ page }) => {
  const pkg = await contentPackage(page);
  await startExam(page, "C-diff");
  // In the exam: two wrong, one right, the rest unanswered (unanswered isn't a mistake).
  const wrong = new Set<string>();
  wrong.add((await currentQuestion(page, pkg)).id);
  await answer(page, pkg, false);
  await page.getByRole("button", { name: "Next" }).click();
  wrong.add((await currentQuestion(page, pkg)).id);
  await answer(page, pkg, false);
  await page.getByRole("button", { name: "Next" }).click();
  const right = (await currentQuestion(page, pkg)).id;
  await answer(page, pkg, true);
  await page.getByRole("button", { name: "Submit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();
  await expect(page.getByRole("heading", { name: "Respins" })).toBeVisible();

  // In learning mode: the first question not seen yet, answered wrong.
  await page.goto("/invatare/colreg");
  const learned = await shownId(page);
  expect([...wrong, right]).not.toContain(learned);
  wrong.add(learned);
  await answer(page, pkg, false);
  await expect(page.getByTestId("feedback")).toBeVisible();

  await page.goto("/invatare");
  await expect(page.getByTestId("mistakes-count")).toHaveText("3");
  await page.getByRole("link", { name: "Practică greșelile" }).click();
  const seen = new Set<string>();
  let fixed = "";
  for (let i = 1; i <= 3; i++) {
    await expect(page.getByText(`Întrebarea ${i} din 3`)).toBeVisible();
    const id = await shownId(page);
    seen.add(id);
    // The first one is answered right this time, the others wrong again.
    if (i === 1) fixed = id;
    await answer(page, pkg, i === 1);
    await page.getByRole("button", { name: "Next" }).click();
  }
  expect(seen).toEqual(wrong);
  await expect(page.getByTestId("session-score")).toHaveText("Ai răspuns corect la 1 din 3.");

  // The question answered right is no longer a mistake.
  await page.goto("/invatare/greseli");
  await expect(page.getByText("Întrebarea 1 din 2")).toBeVisible();
  const next = new Set<string>();
  for (let i = 1; i <= 2; i++) {
    next.add(await shownId(page));
    await answer(page, pkg, false);
    await page.getByRole("button", { name: "Next" }).click();
  }
  wrong.delete(fixed);
  expect(next).toEqual(wrong);
});

test("the learning page shows coverage and marks weak subjects", async ({ page }) => {
  const pkg = await contentPackage(page);
  await signInWith(page, "C-diff");
  const total = subjectOrder(pkg, "C-diff", "colreg").length;
  await page.goto("/invatare");
  await expectCounts(page, "colreg", `0 din ${total}`, 0, 0);
  await expect(subjectRow(page, "colreg").getByText("Punct slab")).toHaveCount(0);

  await page.goto("/invatare/colreg");
  for (let i = 1; i <= 5; i++) {
    await answer(page, pkg, i === 1);
    await page.getByRole("button", { name: "Next" }).click();
  }
  await page.goto("/invatare");
  await expectCounts(page, "colreg", `5 din ${total}`, 1, 4);
  await expect(subjectRow(page, "colreg").getByText("Punct slab")).toBeVisible();
});

test("the learning page lists every subject of the exam type", async ({ page }) => {
  const pkg = await contentPackage(page);
  await signInWith(page, "C");
  const ids = new Set(pkg.examTypes.find((t) => t.id === "C")!.questionIds);
  const subjects = new Set(pkg.questions.filter((q) => ids.has(q.id)).map((q) => q.subject));
  await page.goto("/invatare");
  await expect(page.getByTestId("subject")).toHaveCount(subjects.size);
  for (const s of subjects) await expectCounts(page, s, `0 din ${subjectOrder(pkg, "C", s).length}`, 0, 0);
});

test("an unfinished exam's answers don't count yet", async ({ page }) => {
  const pkg = await contentPackage(page);
  await startExam(page, "C-diff");
  await answer(page, pkg, false);
  const total = subjectOrder(pkg, "C-diff", "colreg").length;
  await page.goto("/invatare");
  await expectCounts(page, "colreg", `0 din ${total}`, 0, 0);
});

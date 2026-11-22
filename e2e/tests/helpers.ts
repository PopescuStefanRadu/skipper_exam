import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// Every test signs in as its own user, so tests can run in parallel.
export function uniqueEmail(): string {
  return `test-${randomUUID()}@example.test`;
}

// Signs in through the stack's fake sign-in service (a mock OpenID Connect server
// standing in for Authentik and Google), as the user with the given email. The
// first sign-in creates the account.
export async function signIn(page: Page, email = uniqueEmail()): Promise<string> {
  await page.goto("/autentificare");
  await page.getByRole("button", { name: "Continuă cu Google" }).click();
  await signInAtProvider(page, email);
  return email;
}

// Fills the fake sign-in service's form: the user ID, then the claims it sends.
export async function signInAtProvider(page: Page, email: string) {
  await page.locator("input[name=username]").fill(email);
  await page.locator("textarea[name=claims]").fill(JSON.stringify({ email }));
  await page.locator("input[type=submit]").click();
}

export async function expectSignedInAs(page: Page, email: string) {
  await expect(page.getByTestId("signed-in-email")).toHaveText(email);
}

// Sets the signed-in user's exam types through the API, for tests that don't
// exercise choosing them.
export async function setExamType(page: Page, ...examTypes: string[]) {
  const res = await page.request.put("/api/profile", { data: { examTypes } });
  expect(res.ok()).toBeTruthy();
}

// The question content as the app receives it, so tests know the correct answers.
export interface ContentQuestion {
  id: string;
  text: string;
  answers: { text: string; correct: boolean }[];
  subject: string;
  group?: string;
}
export interface ContentPackage {
  version: string;
  questions: ContentQuestion[];
  examTypes: { id: string; questionIds?: string[]; format?: { questions: number; minutes: number; passPercent: number } }[];
}

export async function contentPackage(page: Page): Promise<ContentPackage> {
  const res = await page.request.get("/api/content");
  expect(res.ok()).toBeTruthy();
  return res.json();
}

// Signs in a new account with the given exam type and starts an exam.
export async function startExam(page: Page, examType: string) {
  await signIn(page);
  await expect(page).toHaveURL("/tip-examen");
  await setExamType(page, examType);
  await page.goto("/");
  await page.getByRole("button", { name: "Începe examenul" }).click();
  await expect(page).toHaveURL("/examen");
}

// The question currently on the exam screen.
export async function currentQuestion(page: Page, pkg: ContentPackage): Promise<ContentQuestion> {
  const id = await page.getByTestId("question").getAttribute("data-question-id");
  const q = pkg.questions.find((q) => q.id === id);
  if (!q) throw new Error(`question ${id} not in the content package`);
  return q;
}

// Answers the current question, correctly or not, and returns the chosen answer's text.
export async function answer(page: Page, pkg: ContentPackage, correctly: boolean): Promise<string> {
  const q = await currentQuestion(page, pkg);
  const choice = q.answers.find((a) => a.correct === correctly)!;
  await page.getByRole("radio", { name: choice.text, exact: true }).check();
  return choice.text;
}

export async function expectQuestionNumber(page: Page, n: number, total: number) {
  await expect(page.getByText(`Întrebarea ${n} din ${total}`)).toBeVisible();
}

// Records a whole exam through the API, as the app would after a sync: started at
// `start`, the first `correct` questions answered right and the rest wrong, then
// submitted after `minutes` (or abandoned).
export async function recordExam(
  page: Page,
  pkg: ContentPackage,
  opts: { examType: string; correct: number; start: Date; minutes?: number; abandon?: boolean },
): Promise<string> {
  const type = pkg.examTypes.find((t) => t.id === opts.examType)!;
  const byId = new Map(pkg.questions.map((q) => [q.id, q]));
  const groups = new Set<string>();
  const questions: { id: string; order: number[] }[] = [];
  for (const id of type.questionIds!) {
    const q = byId.get(id)!;
    const g = q.group ?? q.id;
    if (groups.has(g) || q.answers.filter((a) => a.correct).length !== 1) continue;
    groups.add(g);
    questions.push({ id, order: q.answers.map((_, i) => i) });
    if (questions.length === type.format!.questions) break;
  }
  const examId = randomUUID();
  const t = opts.start.getTime();
  const at = (ms: number) => new Date(t + ms).toISOString();
  const events: object[] = [
    {
      id: randomUUID(),
      type: "exam.started",
      at: at(0),
      data: {
        examId,
        examType: type.id,
        contentVersion: pkg.version,
        minutes: type.format!.minutes,
        passPercent: type.format!.passPercent,
        questions,
      },
    },
  ];
  questions.forEach(({ id }, i) => {
    const q = byId.get(id)!;
    const right = q.answers.findIndex((a) => a.correct);
    events.push({
      id: randomUUID(),
      type: "exam.answered",
      at: at(1000 * (i + 1)),
      data: { examId, questionId: id, answer: i < opts.correct ? right : (right + 1) % q.answers.length },
    });
  });
  events.push({
    id: randomUUID(),
    type: opts.abandon ? "exam.abandoned" : "exam.submitted",
    at: at((opts.minutes ?? 20) * 60_000),
    data: opts.abandon ? { examId } : { examId, reason: "submit" },
  });
  const res = await page.request.post("/api/events", { data: { events } });
  expect(res.ok()).toBeTruthy();
  return examId;
}


import { expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { stackEnv } from "../stack";

export const password = "o-parola-de-test-123";

// Every test uses its own account, so tests can run in parallel.
export function uniqueEmail(): string {
  return `test-${randomUUID()}@example.test`;
}

// Creates an account directly through the Kratos admin API, for tests that only
// need an existing account.
export async function createAccount(email = uniqueEmail()): Promise<string> {
  const res = await fetch(`${stackEnv().KRATOS_ADMIN_URL}/admin/identities`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      schema_id: "default",
      traits: { email },
      credentials: { password: { config: { password } } },
    }),
  });
  if (!res.ok) throw new Error(`create account: ${res.status} ${await res.text()}`);
  return email;
}

export async function signIn(page: Page, email: string, pass = password) {
  await page.goto("/autentificare");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parolă").fill(pass);
  await page.getByRole("button", { name: "Intră în cont" }).click();
}

export async function signUp(page: Page, email: string, pass = password) {
  await page.goto("/inregistrare");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Parolă").fill(pass);
  await page.getByRole("button", { name: "Creează contul" }).click();
}

export async function expectSignedInAs(page: Page, email: string) {
  await expect(page.getByTestId("signed-in-email")).toHaveText(email);
}

// Signs in through the fake Google provider (the stack's mock OpenID Connect
// server), as the Google user with the given email.
export async function continueWithGoogle(page: Page, email: string) {
  await page.getByRole("button", { name: "Continuă cu Google" }).click();
  await page.locator("input[name=username]").fill(email);
  await page.locator("textarea[name=claims]").fill(JSON.stringify({ email, email_verified: true }));
  await page.locator("input[type=submit]").click();
}

// Sets the signed-in user's exam type through the API, for tests that don't
// exercise choosing it.
export async function setExamType(page: Page, examType: string) {
  const res = await page.request.put("/api/profile", { data: { examType } });
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
  await signIn(page, await createAccount());
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

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

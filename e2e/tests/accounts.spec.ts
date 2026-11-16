import { expect, test } from "@playwright/test";
import { createAccount, expectSignedInAs, password, signIn, signUp, uniqueEmail } from "./helpers";

test("sign up, stay signed in after a reload, then sign out", async ({ page }) => {
  const email = uniqueEmail();
  await signUp(page, email);
  await expect(page).toHaveURL("/");
  await expectSignedInAs(page, email);

  await page.reload();
  await expectSignedInAs(page, email);

  await page.getByRole("button", { name: "Ieșire din cont" }).click();
  await expect(page).toHaveURL("/autentificare");
  await page.goto("/");
  await expect(page).toHaveURL("/autentificare");
});

test("signing in on a second device opens the same account", async ({ browser }) => {
  const email = await createAccount();
  const first = await browser.newContext();
  const second = await browser.newContext();
  const pageA = await first.newPage();
  const pageB = await second.newPage();

  await signIn(pageA, email);
  await expectSignedInAs(pageA, email);
  await signIn(pageB, email);
  await expectSignedInAs(pageB, email);

  await first.close();
  await second.close();
});

test("opening the app while signed out leads to sign-in", async ({ page }) => {
  await page.goto("/examen/oricare");
  await expect(page).toHaveURL("/autentificare");
  await expect(page.getByRole("heading", { name: "Autentificare" })).toBeVisible();
});

test("a wrong password is refused without revealing account details", async ({ page }) => {
  const email = await createAccount();
  await signIn(page, email, "parola-gresita-123");
  await expect(page.getByRole("alert")).toHaveText("Emailul sau parola nu sunt corecte.");
  await expect(page).toHaveURL("/autentificare");
});

test("an unknown email gets the same message as a wrong password", async ({ page }) => {
  await signIn(page, uniqueEmail(), password);
  await expect(page.getByRole("alert")).toHaveText("Emailul sau parola nu sunt corecte.");
});

test("signing up with an email that is already used is refused", async ({ page }) => {
  const email = await createAccount();
  await signUp(page, email);
  await expect(page.getByRole("alert")).toHaveText("Există deja un cont cu acest email.");
  await expect(page).toHaveURL("/inregistrare");
});

test("a password shorter than 8 characters is refused", async ({ page }) => {
  await signUp(page, uniqueEmail(), "scurt");
  await expect(page.getByRole("alert")).toContainText("cel puțin 8 caractere");
});

test("after a refused attempt, the form works again", async ({ page }) => {
  const email = await createAccount();
  await signIn(page, email, "parola-gresita-123");
  await expect(page.getByRole("alert")).toBeVisible();
  // The email typed before stays; only the password is typed again.
  await expect(page.getByLabel("Email")).toHaveValue(email);
  await page.getByLabel("Parolă").fill(password);
  await page.getByRole("button", { name: "Intră în cont" }).click();
  await expectSignedInAs(page, email);
});

import { expect, test, type Page } from "@playwright/test";
import { createAccount, expectSignedInAs, password, signIn, uniqueEmail } from "./helpers";
import { recoveryCode } from "./mail";

const newPassword = "o-parola-noua-456";

async function requestReset(page: Page, email: string) {
  await page.goto("/autentificare");
  await page.getByRole("link", { name: "Ai uitat parola?" }).click();
  await expect(page).toHaveURL("/recuperare");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Trimite codul" }).click();
  await expect(page.getByText("Dacă există un cont cu acest email, ți-am trimis un cod.")).toBeVisible();
}

test("reset a forgotten password and sign in with the new one", async ({ page }) => {
  const email = await createAccount();
  await requestReset(page, email);

  await page.getByLabel("Cod").fill(await recoveryCode(email));
  await page.getByRole("button", { name: "Confirmă codul" }).click();

  await expect(page.getByRole("heading", { name: "Parolă nouă" })).toBeVisible();
  await page.getByLabel("Parolă nouă").fill(newPassword);
  await page.getByRole("button", { name: "Salvează parola" }).click();
  await expectSignedInAs(page, email);

  await page.getByRole("button", { name: "Ieșire din cont" }).click();
  await signIn(page, email, password);
  await expect(page.getByRole("alert")).toHaveText("Emailul sau parola nu sunt corecte.");
  await signIn(page, email, newPassword);
  await expectSignedInAs(page, email);
});

test("a wrong recovery code is refused", async ({ page }) => {
  const email = await createAccount();
  await requestReset(page, email);
  await recoveryCode(email); // wait until the real code was sent
  await page.getByLabel("Cod").fill("000000");
  await page.getByRole("button", { name: "Confirmă codul" }).click();
  await expect(page.getByRole("alert")).toHaveText("Codul nu este corect sau a expirat.");
});

test("an unknown email gets the same confirmation, without revealing that no account exists", async ({ page }) => {
  await requestReset(page, uniqueEmail());
  await expect(page.getByLabel("Cod")).toBeVisible();
});

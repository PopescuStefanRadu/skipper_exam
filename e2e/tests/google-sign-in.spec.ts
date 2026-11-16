import { expect, test } from "@playwright/test";
import { continueWithGoogle, createAccount, expectSignedInAs, password, uniqueEmail } from "./helpers";

test("sign up with Google, then sign in with Google on another device", async ({ browser }) => {
  const email = uniqueEmail();
  const first = await (await browser.newContext()).newPage();
  await first.goto("/inregistrare");
  await continueWithGoogle(first, email);
  await expectSignedInAs(first, email);

  const second = await (await browser.newContext()).newPage();
  await second.goto("/autentificare");
  await continueWithGoogle(second, email);
  await expectSignedInAs(second, email);
});

test("Google sign-in with the email of a password account links Google to that account", async ({ browser }) => {
  const email = await createAccount();
  const page = await (await browser.newContext()).newPage();
  await page.goto("/autentificare");
  await continueWithGoogle(page, email);

  // No second account: the user confirms with the existing password once.
  await expect(page.getByText("Există deja un cont cu acest email. Intră cu parola contului pentru a-l lega de Google.")).toBeVisible();
  await page.getByLabel("Parolă").fill(password);
  await page.getByRole("button", { name: "Intră în cont" }).click();
  await expectSignedInAs(page, email);

  // From now on, Google alone opens the same account.
  const other = await (await browser.newContext()).newPage();
  await other.goto("/autentificare");
  await continueWithGoogle(other, email);
  await expectSignedInAs(other, email);
});

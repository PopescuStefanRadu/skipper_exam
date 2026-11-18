import { expect, test } from "@playwright/test";
import { signIn, uniqueEmail } from "./helpers";

test("a new user chooses the exam type right after signing up, and it follows the account", async ({ browser }) => {
  const email = uniqueEmail();
  const page = await (await browser.newContext()).newPage();
  await signIn(page, email);

  await expect(page).toHaveURL("/tip-examen");
  await expect(page.getByRole("heading", { name: "Pentru ce examen te pregătești?" })).toBeVisible();
  await page.getByLabel("Clasa D", { exact: true }).check();
  await page.getByRole("button", { name: "Salvează" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("exam-type")).toHaveText("Clasa D");
  await page.reload();
  await expect(page.getByTestId("exam-type")).toHaveText("Clasa D");

  const other = await (await browser.newContext()).newPage();
  await signIn(other, email);
  await expect(other.getByTestId("exam-type")).toHaveText("Clasa D");
});

test("changing the exam type later", async ({ page }) => {
  await signIn(page, uniqueEmail());
  await page.getByLabel("Clasa D", { exact: true }).check();
  await page.getByRole("button", { name: "Salvează" }).click();

  await page.getByRole("link", { name: "Schimbă examenul" }).click();
  await expect(page.getByLabel("Clasa D", { exact: true })).toBeChecked();
  await page.getByLabel("Clasa C, examen de diferență").check();
  await page.getByRole("button", { name: "Salvează" }).click();
  await expect(page.getByTestId("exam-type")).toHaveText("Clasa C, examen de diferență");
});

test("class A and B are listed as not available yet and can't be chosen", async ({ page }) => {
  await signIn(page, uniqueEmail());
  for (const name of ["Clasa A", "Clasa B"]) {
    await expect(page.getByLabel(name, { exact: true })).toBeDisabled();
  }
  await expect(page.getByText("Nu este disponibil încă").first()).toBeVisible();
});

test("a signed-in user without an exam type is asked to choose one first", async ({ page }) => {
  const email = uniqueEmail();
  await signIn(page, email);
  await expect(page).toHaveURL("/tip-examen");
  await page.goto("/");
  await expect(page).toHaveURL("/tip-examen");
});

test("the server refuses an exam type that isn't available", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL("/tip-examen");
  const res = await page.request.put("/api/profile", { data: { examType: "A" } });
  expect(res.status()).toBe(400);
});

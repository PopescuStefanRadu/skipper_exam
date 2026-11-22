// The privacy policy and the terms of use (docs/app/features/legal.md).
import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

async function expectOperator(page: Page) {
  await expect(page.getByText("SRP HYPERPLAY S.R.L.").first()).toBeVisible();
  await expect(page.getByText("49509067").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "popescustefanradu@gmail.com" }).first()).toBeVisible();
}

test("signed out, the sign-in page links to the privacy policy and the terms", async ({ page }) => {
  await page.goto("/autentificare");
  await page.getByRole("link", { name: "Confidențialitate", exact: true }).click();
  await expect(page).toHaveURL("/confidentialitate");
  await expect(page.getByRole("heading", { name: "Politica de confidențialitate" })).toBeVisible();
  await expectOperator(page);
  await expect(page.getByText("ANSPDCP").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "esrp.ro/privacy" })).toHaveAttribute("href", "https://esrp.ro/privacy");
  await expect(page.getByText("Evidența autentificărilor la serviciul esrp.ro: 90 de zile.")).toBeVisible();
  await expect(page.getByText("Jurnalele tehnice ale serverelor: cel mult 7 zile.")).toBeVisible();

  await page.getByRole("link", { name: "Termeni", exact: true }).click();
  await expect(page).toHaveURL("/termeni");
  await expect(page.getByRole("heading", { name: "Termeni și condiții" })).toBeVisible();
  await expectOperator(page);
});

test("the legal pages open directly without an account", async ({ page }) => {
  for (const [path, title] of [
    ["/confidentialitate", "Politica de confidențialitate"],
    ["/termeni", "Termeni și condiții"],
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(path);
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
    await expect(page.getByText(/Ultima actualizare/)).toBeVisible();
  }
});

test("signed in, the footer links to both pages and the app is one click away", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL("/tip-examen");
  await page.getByRole("link", { name: "Termeni", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Termeni și condiții" })).toBeVisible();
  await page.getByRole("link", { name: "Confidențialitate", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Politica de confidențialitate" })).toBeVisible();
  await page.getByRole("link", { name: "Examen CAA" }).click();
  await expect(page).toHaveURL("/tip-examen");
});

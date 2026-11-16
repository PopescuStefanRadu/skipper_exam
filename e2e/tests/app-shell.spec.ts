import { expect, test } from "@playwright/test";

test("the app opens and is connected to the server", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Examen CAA");
  await expect(page.getByRole("heading", { name: "Examen CAA" })).toBeVisible();
  await expect(page.getByTestId("server-status")).toHaveAttribute("data-state", "ok");
  await expect(page.getByTestId("server-status")).toHaveText("Conectat");
});

test("a deep link opens the app instead of a not-found page", async ({ page }) => {
  const response = await page.goto("/examen/oricare");
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Examen CAA" })).toBeVisible();
});

test("the backend being unavailable shows a clear message", async ({ page }) => {
  await page.route("**/api/health", (route) => route.abort("connectionrefused"));
  await page.goto("/");
  await expect(page.getByTestId("server-status")).toHaveAttribute("data-state", "unavailable");
  await expect(page.getByTestId("server-status")).toHaveText("Serverul nu este disponibil");
});

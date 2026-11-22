import { expect, test } from "@playwright/test";
import { contentPackage, currentQuestion, setExamType, signIn, uniqueEmail } from "./helpers";

test("a new user chooses the exam type right after signing up, and it follows the account", async ({ browser }) => {
  const email = uniqueEmail();
  const page = await (await browser.newContext()).newPage();
  await signIn(page, email);

  await expect(page).toHaveURL("/tip-examen");
  await expect(page.getByRole("heading", { name: "Pentru ce examene te pregătești?" })).toBeVisible();
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

  await page.getByRole("link", { name: "Schimbă examenele" }).click();
  await expect(page.getByLabel("Clasa D", { exact: true })).toBeChecked();
  await page.getByLabel("Clasa D", { exact: true }).uncheck();
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
  const res = await page.request.put("/api/profile", { data: { examTypes: ["C", "A"] } });
  expect(res.status()).toBe(400);
});

test("at least one exam type must be chosen", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL("/tip-examen");
  const save = page.getByRole("button", { name: "Salvează" });
  await expect(save).toBeDisabled();
  await page.getByLabel("Clasa C", { exact: true }).check();
  await expect(save).toBeEnabled();
  await page.getByLabel("Clasa C", { exact: true }).uncheck();
  await expect(save).toBeDisabled();
  const res = await page.request.put("/api/profile", { data: { examTypes: [] } });
  expect(res.status()).toBe(400);
});

test("preparing for class C and class D at the same time", async ({ page }) => {
  const pkg = await contentPackage(page);
  await signIn(page);
  await expect(page.getByText("Poți alege mai multe.")).toBeVisible();
  await page.getByLabel("Clasa C", { exact: true }).check();
  await page.getByLabel("Clasa D", { exact: true }).check();
  await page.getByRole("button", { name: "Salvează" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.getByTestId("exam-type")).toHaveText(["Clasa C", "Clasa D"]);
  const examC = page.getByRole("region", { name: "Examen simulat: Clasa C" });
  const examD = page.getByRole("region", { name: "Examen simulat: Clasa D" });
  await expect(examC.getByRole("button", { name: "Începe examenul" })).toBeVisible();
  await expect(examD.getByRole("button", { name: "Începe examenul" })).toBeVisible();

  // Each exam draws only from its own list.
  await examD.getByRole("button", { name: "Începe examenul" }).click();
  await expect(page).toHaveURL("/examen");
  const allowedD = new Set(pkg.examTypes.find((t) => t.id === "D")!.questionIds);
  expect(allowedD.has((await currentQuestion(page, pkg)).id)).toBe(true);
  await expect(page.getByTestId("exam-name")).toHaveText("Clasa D");

  // While it runs, the home page offers to resume it and starts no other exam.
  await page.goto("/");
  await expect(examD.getByRole("button", { name: "Continuă examenul" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Începe examenul" })).toHaveCount(0);
  await examD.getByRole("button", { name: "Renunță la examen" }).click();
  await examC.getByRole("button", { name: "Începe examenul" }).click();
  const allowedC = new Set(pkg.examTypes.find((t) => t.id === "C")!.questionIds);
  expect(allowedC.has((await currentQuestion(page, pkg)).id)).toBe(true);

  // Learning covers the subjects of both lists.
  await page.goto("/invatare");
  await expect(page.locator('[data-testid="subject"][data-subject="colreg"]')).toBeVisible();
  await expect(page.locator('[data-testid="subject"][data-subject="rnd"]')).toBeVisible();
});

test("learning with one class covers only that class's subjects", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL("/tip-examen");
  await setExamType(page, "C");
  await page.goto("/invatare");
  await expect(page.locator('[data-testid="subject"][data-subject="colreg"]')).toBeVisible();
  await expect(page.locator('[data-testid="subject"][data-subject="rnd"]')).toHaveCount(0);
});

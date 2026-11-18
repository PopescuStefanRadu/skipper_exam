import { expect, test } from "@playwright/test";
import { answer, contentPackage, currentQuestion, signIn, startExam } from "./helpers";
import { claimExplanation, createReviewer, explanations, releaseExplanation } from "./review";

const unverified = "Neverificată";

test("the explanation of a wrong answer quotes the source and opens it at the page", async ({ page }) => {
  const pkg = await contentPackage(page);
  await startExam(page, "C-diff");
  // A COLREG question with an explanation: C-diff exams only have COLREG questions.
  const all = await explanations(page);
  let q = await currentQuestion(page, pkg);
  while (!all.some((e) => e.questionId === q.id && e.status !== "rejected")) {
    await page.getByRole("button", { name: "Next" }).click();
    q = await currentQuestion(page, pkg);
  }
  const given = await answer(page, pkg, false);
  const correct = q.answers.find((a) => a.correct)!.text;
  const e = all.find((e) => e.questionId === q.id)!;
  await page.getByRole("button", { name: "Submit" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Submit" }).click();

  await page.locator(`[data-question-id="${q.id}"]`).getByRole("link", { name: "Vezi explicația" }).click();
  await expect(page).toHaveURL(`/intrebare/${q.id}`);
  await expect(page.getByTestId("question-text")).toHaveText(q.text);
  await expect(page.getByTestId("given")).toHaveText(given);
  await expect(page.getByTestId("correct")).toHaveText(correct);
  await expect(page.getByTestId("quote")).toHaveText(e.quote);
  await expect(page.getByTestId("reference")).toContainText(e.reference);
  await expect(page.getByTestId("reference")).toContainText(`pagina ${e.page}`);

  const link = page.getByRole("link", { name: "Deschide documentul" });
  await expect(link).toHaveAttribute("href", `/api/sources/${e.source}#page=${e.page}`);
  const pdf = await page.request.get(`/api/sources/${e.source}`);
  expect(pdf.ok()).toBeTruthy();
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
});

test("a suggested explanation is labelled unverified", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL("/tip-examen");
  const e = (await explanations(page)).find((e) => e.status === "suggested" && e.source.startsWith("colreg"))!;
  await page.goto(`/intrebare/${e.questionId}`);
  await expect(page.getByTestId("quote")).toHaveText(e.quote);
  await expect(page.getByText(unverified)).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirmă" })).toHaveCount(0);
});

test("a question without an explanation says so", async ({ page }) => {
  const pkg = await contentPackage(page);
  await signIn(page);
  await expect(page).toHaveURL("/tip-examen");
  const explained = new Set((await explanations(page)).map((e) => e.questionId));
  const q = pkg.questions.find((q) => !explained.has(q.id))!;
  await page.goto(`/intrebare/${q.id}`);
  await expect(page.getByTestId("question-text")).toHaveText(q.text);
  await expect(page.getByText("Nu există încă o explicație pentru această întrebare.")).toBeVisible();
});

test.describe("reviewing", () => {
  let questionId = "";
  test.afterEach(async () => {
    if (questionId) await releaseExplanation(questionId);
  });

  test("a reviewer confirms an explanation, and it's verified for everyone", async ({ page, browser }) => {
    await createReviewer(page);
    await expect(page).toHaveURL("/tip-examen");
    questionId = await claimExplanation(await explanations(page));
    await page.goto(`/intrebare/${questionId}`);
    await expect(page.getByText(unverified)).toBeVisible();
    await page.getByRole("button", { name: "Confirmă" }).click();
    await expect(page.getByText("Verificată")).toBeVisible();
    await expect(page.getByText(unverified)).toHaveCount(0);

    const other = await (await browser.newContext()).newPage();
    await signIn(other);
    await expect(other).toHaveURL("/tip-examen");
    await other.goto(`/intrebare/${questionId}`);
    await expect(other.getByText("Verificată")).toBeVisible();
    await expect(other.getByRole("button", { name: "Confirmă" })).toHaveCount(0);
  });

  test("a reviewer rejects an explanation, then undoes it", async ({ page, browser }) => {
    await createReviewer(page);
    await expect(page).toHaveURL("/tip-examen");
    const all = await explanations(page);
    questionId = await claimExplanation(all);
    const quote = all.find((e) => e.questionId === questionId)!.quote;
    await page.goto(`/intrebare/${questionId}`);
    await page.getByRole("button", { name: "Respinge" }).click();
    await expect(page.getByText("Nu există încă o explicație pentru această întrebare.")).toBeVisible();

    const other = await (await browser.newContext()).newPage();
    await signIn(other);
    await expect(other).toHaveURL("/tip-examen");
    await other.goto(`/intrebare/${questionId}`);
    await expect(other.getByText("Nu există încă o explicație pentru această întrebare.")).toBeVisible();

    await page.getByRole("button", { name: "Anulează" }).click();
    await expect(page.getByTestId("quote")).toHaveText(quote);
    await expect(page.getByText(unverified)).toBeVisible();
  });

  test("a reviewer corrects an explanation; a quote that isn't on the page is refused", async ({ page }) => {
    await createReviewer(page);
    await expect(page).toHaveURL("/tip-examen");
    const all = await explanations(page);
    questionId = await claimExplanation(all);
    // A real passage from elsewhere in the R.N.D. stands in for the correction.
    const other = all.find((e) => e.source === "rnd" && e.questionId !== questionId)!;
    await page.goto(`/intrebare/${questionId}`);
    await page.getByRole("button", { name: "Corectează" }).click();
    await page.getByLabel("Document").selectOption(other.source);
    await page.getByLabel("Pagina").fill(String(other.page));
    await page.getByLabel("Referința").fill(other.reference);
    await page.getByLabel("Citatul").fill("un text care nu există în document");
    await page.getByRole("button", { name: "Salvează corectura" }).click();
    await expect(page.getByRole("alert")).toHaveText("Citatul nu se găsește pe pagina indicată.");

    await page.getByLabel("Citatul").fill(other.quote);
    await page.getByRole("button", { name: "Salvează corectura" }).click();
    await expect(page.getByTestId("quote")).toHaveText(other.quote);
    await expect(page.getByTestId("reference")).toContainText(`pagina ${other.page}`);
    await expect(page.getByText("Verificată")).toBeVisible();
  });

  test("a reviewer flags a question, and everyone sees it's being checked", async ({ page, browser }) => {
    await createReviewer(page);
    await expect(page).toHaveURL("/tip-examen");
    questionId = await claimExplanation(await explanations(page));
    await page.goto(`/intrebare/${questionId}`);
    await page.getByRole("button", { name: "Semnalează" }).click();
    await page.getByLabel("Ce pare greșit?").fill("Răspunsul oficial contrazice regulamentul.");
    await page.getByRole("button", { name: "Trimite semnalarea" }).click();
    await expect(page.getByText("Întrebarea este în curs de verificare.")).toBeVisible();

    const other = await (await browser.newContext()).newPage();
    await signIn(other);
    await expect(other).toHaveURL("/tip-examen");
    await other.goto(`/intrebare/${questionId}`);
    await expect(other.getByText("Întrebarea este în curs de verificare.")).toBeVisible();
  });
});

test("a normal user can't review, also through the API", async ({ page }) => {
  await signIn(page);
  await expect(page).toHaveURL("/tip-examen");
  const e = (await explanations(page))[0];
  await page.goto(`/intrebare/${e.questionId}`);
  await expect(page.getByTestId("quote")).toBeVisible();
  for (const name of ["Confirmă", "Respinge", "Corectează", "Semnalează"]) {
    await expect(page.getByRole("button", { name })).toHaveCount(0);
  }
  const res = await page.request.post("/api/reviews", {
    data: { id: "6f1c1f2e-8a63-4c38-9a59-0f2d1c9b3a10", questionId: e.questionId, action: "confirm" },
  });
  expect(res.status()).toBe(403);
});

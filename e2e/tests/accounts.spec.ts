// Signing in through esrp.ro's sign-in service (docs/app/features/accounts.md). In
// the stack a mock OpenID Connect server stands in for it.
import { expect, test } from "@playwright/test";
import { expectSignedInAs, signIn, signInAtProvider, uniqueEmail } from "./helpers";

test("the first sign-in creates the account; it stays signed in after a reload, then signs out", async ({ page }) => {
  const email = await signIn(page);
  await expect(page).toHaveURL("/tip-examen");
  await expectSignedInAs(page, email);

  await page.reload();
  await expectSignedInAs(page, email);

  await page.getByRole("button", { name: "Ieșire din cont" }).click();
  await expect(page).toHaveURL("/autentificare");
  await page.goto("/");
  await expect(page).toHaveURL("/autentificare");
});

test("signing in on a second device opens the same account", async ({ browser }) => {
  const email = uniqueEmail();
  const pageA = await (await browser.newContext()).newPage();
  const pageB = await (await browser.newContext()).newPage();

  await signIn(pageA, email);
  await expect(pageA).toHaveURL("/tip-examen");
  await pageA.request.put("/api/profile", { data: { examType: "C" } });
  const a = await (await pageA.request.get("/api/me")).json();

  await signIn(pageB, email);
  // The exam type chosen on the first device is already there.
  await expect(pageB).toHaveURL("/");
  await expectSignedInAs(pageB, email);
  const b = await (await pageB.request.get("/api/me")).json();
  expect(b.id).toBe(a.id);
});

test("two users never see each other's progress", async ({ browser }) => {
  const pageA = await (await browser.newContext()).newPage();
  const pageB = await (await browser.newContext()).newPage();
  await signIn(pageA);
  await expect(pageA).toHaveURL("/tip-examen");
  await signIn(pageB);
  await expect(pageB).toHaveURL("/tip-examen");
  const res = await pageA.request.post("/api/events", {
    data: { events: [{ id: crypto.randomUUID(), type: "exam.abandoned", at: new Date().toISOString(), data: { examId: "x" } }] },
  });
  expect(res.ok()).toBeTruthy();
  expect(await (await pageB.request.get("/api/events")).json()).toEqual([]);
});

test("the sign-in page offers only the sign-in service", async ({ page }) => {
  await page.goto("/autentificare");
  await expect(page.getByRole("heading", { name: "Autentificare" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuă cu Google" })).toBeVisible();
  await expect(page.getByLabel("Parolă")).toHaveCount(0);
});

test("a cancelled or failed sign-in returns to the sign-in page with a message", async ({ page }) => {
  await page.goto("/autentificare");
  await page.getByRole("button", { name: "Continuă cu Google" }).click();
  await expect(page.locator("input[name=username]")).toBeVisible();
  // The sign-in service sends the browser back with an error instead of a code.
  const authorize = new URL(page.url());
  const back = new URL(authorize.searchParams.get("redirect_uri")!);
  back.searchParams.set("error", "access_denied");
  back.searchParams.set("state", authorize.searchParams.get("state")!);
  await page.goto(back.toString());
  await expect(page).toHaveURL(/\/autentificare/);
  await expect(page.getByRole("alert")).toHaveText("Autentificarea nu a reușit. Încearcă din nou.");

  // Trying again works.
  await page.getByRole("button", { name: "Continuă cu Google" }).click();
  const email = uniqueEmail();
  await signInAtProvider(page, email);
  await expectSignedInAs(page, email);
});

test("a stale or forged sign-in answer is refused", async ({ page }) => {
  await page.goto("/auth/callback?code=forged&state=forged");
  await expect(page).toHaveURL(/\/autentificare/);
  await expect(page.getByRole("alert")).toHaveText("Autentificarea nu a reușit. Încearcă din nou.");
  expect((await page.request.get("/api/me")).status()).toBe(401);
});

test("opening the app while signed out leads to sign-in", async ({ page }) => {
  await page.goto("/examen/oricare");
  await expect(page).toHaveURL("/autentificare");
  await expect(page.getByRole("heading", { name: "Autentificare" })).toBeVisible();
});

test("the old sign-up, password reset and settings addresses lead to sign-in", async ({ page }) => {
  for (const path of ["/inregistrare", "/recuperare", "/setari"]) {
    await page.goto(path);
    await expect(page).toHaveURL("/autentificare");
  }
});

test("a signed-out session no longer works, as a cookie or as an app token", async ({ page, playwright }) => {
  await signIn(page);
  await expect(page).toHaveURL("/tip-examen");
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "skipper_session")!;
  expect(session.httpOnly).toBe(true);

  await page.getByRole("button", { name: "Ieșire din cont" }).click();
  await expect(page).toHaveURL("/autentificare");

  // The old cookie value, replayed, and the same value sent as an app token.
  const replay = await playwright.request.newContext({ baseURL: page.url() });
  expect((await replay.get("/api/me", { headers: { Cookie: `skipper_session=${session.value}` } })).status()).toBe(401);
  expect((await replay.get("/api/me", { headers: { "X-Session-Token": session.value } })).status()).toBe(401);
  await replay.dispose();
});

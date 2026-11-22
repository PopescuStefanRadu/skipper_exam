// Signing in through esrp.ro's sign-in service (docs/app/features/accounts.md). The
// backend runs the sign-in (/auth/login, /auth/callback) and keeps the session: a
// cookie on the website, a token in the Android app (see platform.ts).
import { Browser } from "@capacitor/browser";
import { apiFetch, isApp, serverUrl, setSessionToken } from "./platform";

// Leaves for the sign-in service. The website comes back to `returnTo`; the app
// opens the sign-in in the browser, which returns to it through appReturnUrl.
export async function startSignIn(returnTo = "/") {
  if (isApp) {
    await Browser.open({ url: `${serverUrl}/auth/login?platform=app` });
  } else {
    window.location.assign(`/auth/login?return_to=${encodeURIComponent(returnTo)}`);
  }
}

// The app was opened through appReturnUrl at the end of a sign-in: trade the
// one-time code for a session token. Returns whether the app is now signed in.
export async function finishAppSignIn(returnedUrl: string): Promise<boolean> {
  const code = new URL(returnedUrl).searchParams.get("code");
  if (!code) return false;
  const res = await apiFetch("/auth/app-token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code }),
  }).catch(() => null);
  if (!res?.ok) return false;
  const { sessionToken } = (await res.json()) as { sessionToken?: string };
  setSessionToken(sessionToken);
  return Boolean(sessionToken);
}

// Ends the session on the server too; offline, the device forgets it anyway.
// Returns the sign-in service's sign-out page, where the esrp.ro session ends,
// or "" when there is none (or the server couldn't be reached).
export async function signOut(): Promise<string> {
  const res = await apiFetch("/auth/logout", { method: "POST" }).catch(() => null);
  setSessionToken(undefined);
  const body = res?.ok ? ((await res.json().catch(() => ({}))) as { endSessionUrl?: string }) : {};
  return body.endSessionUrl ?? "";
}

// Ends the esrp.ro session at the sign-in service: the website goes to its
// sign-out page; the app opens it in the browser, where that session lives.
export async function endServiceSession(url: string): Promise<void> {
  if (isApp) await Browser.open({ url });
  else window.location.assign(url);
}

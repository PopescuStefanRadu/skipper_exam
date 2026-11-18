// What differs between the website and the Android app. The website talks to its
// own origin and its session is a cookie. The Android app runs in a web view on its
// own origin, talks to the server it was built for, and keeps a session token on the
// device, sent in a header (see docs/app/features/accounts.md).
import { Browser } from "@capacitor/browser";
import { Capacitor } from "@capacitor/core";
import { load, remove, save } from "./storage";

export const isApp = Capacitor.isNativePlatform();

// The backend's address: "" (same origin) on the website.
export const serverUrl: string = isApp ? (import.meta.env.VITE_SERVER_URL ?? "") : "";

// Where the server sends the app back after a sign-in in the browser.
export const appReturnUrl = "ro.skipperexam.app://auth";

const tokenKey = "session-token";

export const sessionToken = () => load<string>(tokenKey);

export function setSessionToken(token: string | undefined) {
  if (token) save(tokenKey, token);
  else remove(tokenKey);
}

// fetch for the backend: a path on it, or a full URL. The app sends its session
// token; the website its cookies.
export function apiFetch(pathOrUrl: string, init: RequestInit = {}): Promise<Response> {
  const url = /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : serverUrl + pathOrUrl;
  if (!isApp) return fetch(url, { credentials: "include", ...init });
  const headers = new Headers(init.headers);
  const token = sessionToken();
  if (token) headers.set("X-Session-Token", token);
  return fetch(url, { ...init, headers, credentials: "omit" });
}

// Opens a page outside the app: a new tab on the website, the browser on Android.
export function openExternal(pathOrUrl: string) {
  const url = /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : serverUrl + pathOrUrl;
  if (isApp) void Browser.open({ url });
  else window.open(url, "_blank", "noreferrer");
}

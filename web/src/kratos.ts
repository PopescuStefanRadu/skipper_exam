// Client for the Kratos self-service flows. Kratos is served on the app's own
// origin under /.ory, so its cookies belong to the app.
import { strings } from "./strings";

const base = "/.ory";

type FlowKind = "login" | "registration" | "recovery";

interface UiNode {
  attributes: { name?: string; value?: unknown };
  messages: UiMessage[];
}

interface UiMessage {
  id: number;
  text: string;
  type: "error" | "info" | "success";
}

export interface Flow {
  id: string;
  state?: string;
  ui: { action: string; nodes: UiNode[]; messages?: UiMessage[] };
}

export type SubmitResult = { ok: true } | { ok: false; errors: string[] };

// Loads a flow Kratos redirected the browser to, e.g. after a Google sign-in that
// needs the user to confirm with their password.
export async function getFlow(kind: FlowKind, id: string): Promise<Flow> {
  const res = await fetch(`${base}/self-service/${kind}/flows?id=${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`could not load ${kind} flow: ${res.status}`);
  return res.json();
}

// Messages the flow carries for the user (errors and information), in Romanian.
export function flowMessages(flow: Flow): { errors: string[]; info: string[] } {
  const all = [...(flow.ui.messages ?? []), ...flow.ui.nodes.flatMap((n) => n.messages)];
  const text = (m: UiMessage) => messageText[m.id] ?? (m.type === "error" ? strings.errors.generic : null);
  const pick = (type: UiMessage["type"]) =>
    [...new Set(all.filter((m) => m.type === type).map(text))].filter((t): t is string => t !== null);
  return { errors: pick("error"), info: pick("info") };
}

// Starts a sign-in with an external provider: Kratos answers with the provider's
// address, which the browser then opens.
export async function startProviderSignIn(flow: Flow, provider: string): Promise<SubmitResult> {
  const res = await fetch(flow.ui.action, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ method: "oidc", provider, csrf_token: csrfToken(flow) }),
  });
  const json = await res.json().catch(() => null);
  if (res.status === 422 && json?.redirect_browser_to) {
    window.location.assign(json.redirect_browser_to);
    return { ok: true };
  }
  return { ok: false, errors: [strings.errors.generic] };
}

export async function createFlow(kind: FlowKind): Promise<Flow> {
  const res = await fetch(`${base}/self-service/${kind}/browser`, {
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`could not start ${kind}: ${res.status}`);
  return res.json();
}

function csrfToken(flow: Flow): string {
  const node = flow.ui.nodes.find((n) => n.attributes.name === "csrf_token");
  return String(node?.attributes.value ?? "");
}

export async function submitFlow(flow: Flow, body: Record<string, unknown>): Promise<SubmitResult> {
  const res = await fetch(flow.ui.action, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ...body, csrf_token: csrfToken(flow) }),
  });
  if (res.ok) return { ok: true };
  // An expired flow or a stale CSRF token: the caller starts a new flow.
  if (res.status === 403 || res.status === 410) return { ok: false, errors: [strings.errors.expired] };
  if (res.status === 400) {
    const failed: Flow = await res.json();
    return { ok: false, errors: messagesOf(failed) };
  }
  return { ok: false, errors: [strings.errors.generic] };
}

// Posts to a flow and returns the updated flow, a redirect, or errors.
type FlowResult = { flow: Flow; errors: string[] } | { redirectTo: string } | { errors: string[] };

async function postFlow(flow: Flow, body: Record<string, unknown>): Promise<FlowResult> {
  const res = await fetch(flow.ui.action, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ...body, csrf_token: csrfToken(flow) }),
  });
  if (res.status === 403 || res.status === 410) return { errors: [strings.errors.expired] };
  const json = await res.json().catch(() => null);
  // Kratos asks the browser to continue elsewhere, e.g. after a valid recovery code.
  if (res.status === 422 && json?.redirect_browser_to) {
    const url = new URL(json.redirect_browser_to);
    return { redirectTo: url.pathname + url.search };
  }
  if ((res.ok || res.status === 400) && json?.ui) {
    const errors = res.ok && !hasErrors(json) ? [] : messagesOf(json);
    return { flow: json, errors };
  }
  return { errors: [strings.errors.generic] };
}

function hasErrors(flow: Flow): boolean {
  return [...(flow.ui.messages ?? []), ...flow.ui.nodes.flatMap((n) => n.messages)].some((m) => m.type === "error");
}

// Recovery: request a code by email, then submit it. A valid code signs the user
// in for a short time and redirects to the settings flow to set a new password.
export const sendRecoveryCode = (flow: Flow, email: string) => postFlow(flow, { method: "code", email });
export const submitRecoveryCode = (flow: Flow, code: string) => postFlow(flow, { method: "code", code });

export async function getSettingsFlow(id: string): Promise<Flow> {
  const res = await fetch(`${base}/self-service/settings/flows?id=${encodeURIComponent(id)}`, {
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (!res.ok) throw new Error(`settings flow: ${res.status}`);
  return res.json();
}

export const setNewPassword = (flow: Flow, password: string) => postFlow(flow, { method: "password", password });

export async function signOut(): Promise<void> {
  const res = await fetch(`${base}/self-service/logout/browser`, {
    headers: { Accept: "application/json" },
    credentials: "include",
  });
  if (!res.ok) return; // already signed out
  const { logout_token } = (await res.json()) as { logout_token: string };
  await fetch(`${base}/self-service/logout?token=${encodeURIComponent(logout_token)}`, {
    headers: { Accept: "application/json" },
    credentials: "include",
  });
}

// Kratos message IDs: https://www.ory.sh/docs/kratos/concepts/ui-messages
const messageText: Record<number, string> = {
  4000002: strings.errors.required,
  4000004: strings.errors.invalidEmail,
  4000006: strings.errors.invalidCredentials,
  4000007: strings.errors.emailTaken,
  4000031: strings.errors.passwordTooSimilar,
  4000032: strings.errors.passwordTooShort,
  1010016: strings.signIn.linkGoogle,
  4060005: strings.errors.expired,
  4060006: strings.errors.invalidCode,
};

function messagesOf(flow: Flow): string[] {
  const all = [...(flow.ui.messages ?? []), ...flow.ui.nodes.flatMap((n) => n.messages)];
  const texts = all.filter((m) => m.type === "error").map((m) => messageText[m.id] ?? strings.errors.generic);
  return texts.length > 0 ? [...new Set(texts)] : [strings.errors.generic];
}

// Client for the Kratos self-service flows. Kratos is served on the app's own
// origin under /.ory, so its cookies belong to the app.
import { strings } from "./strings";

const base = "/.ory";

type FlowKind = "login" | "registration";

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
  ui: { action: string; nodes: UiNode[]; messages?: UiMessage[] };
}

export type SubmitResult = { ok: true } | { ok: false; errors: string[] };

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
};

function messagesOf(flow: Flow): string[] {
  const all = [...(flow.ui.messages ?? []), ...flow.ui.nodes.flatMap((n) => n.messages)];
  const texts = all.filter((m) => m.type === "error").map((m) => messageText[m.id] ?? strings.errors.generic);
  return texts.length > 0 ? [...new Set(texts)] : [strings.errors.generic];
}

import { stackEnv } from "../stack";

interface Summary {
  ID: string;
}

// Waits for the newest email sent to `to` in the stack's Mailpit inbox and returns
// its text. Tests only read mail sent to their own unique address.
export async function latestEmailText(to: string, timeoutMs = 10_000): Promise<string> {
  const base = stackEnv().MAILPIT_URL;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${base}/api/v1/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await res.json()) as { messages: Summary[] };
    if (messages.length > 0) {
      const msg = await fetch(`${base}/api/v1/message/${messages[0].ID}`);
      return ((await msg.json()) as { Text: string }).Text;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no email to ${to} within ${timeoutMs} ms`);
}

export async function recoveryCode(to: string): Promise<string> {
  const text = await latestEmailText(to);
  const code = text.match(/\b(\d{6})\b/)?.[1];
  if (!code) throw new Error(`no 6-digit code in: ${text}`);
  return code;
}

import { useEffect, useState, type FormEvent } from "react";
import { createFlow, submitFlow, type Flow } from "./kratos";
import { strings } from "./strings";

interface Props {
  kind: "login" | "registration";
  title: string;
  submitLabel: string;
  passwordHint?: string;
  onSuccess: () => void;
}

// Email and password form on top of a Kratos login or registration flow.
export function AuthForm({ kind, title, submitLabel, passwordHint, onSuccess }: Props) {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    createFlow(kind).then(setFlow, () => setErrors([strings.errors.generic]));
  }, [kind]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!flow) return;
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const body =
      kind === "login"
        ? { method: "password", identifier: email, password }
        : { method: "password", traits: { email }, password };
    setBusy(true);
    const result = await submitFlow(flow, body);
    setBusy(false);
    if (result.ok) {
      onSuccess();
      return;
    }
    setErrors(result.errors);
    // Kratos flows can't be resubmitted after an error; start a fresh one.
    setFlow(await createFlow(kind));
  }

  return (
    <form onSubmit={submit} noValidate>
      <h2>{title}</h2>
      {errors.length > 0 && (
        <ul role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <label>
        {strings.email}
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        {strings.password}
        <input
          name="password"
          type="password"
          autoComplete={kind === "login" ? "current-password" : "new-password"}
          required
        />
      </label>
      {passwordHint && <p>{passwordHint}</p>}
      <button type="submit" disabled={!flow || busy}>
        {submitLabel}
      </button>
    </form>
  );
}

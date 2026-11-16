import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { createFlow, flowMessages, getFlow, startProviderSignIn, submitFlow, type Flow } from "./kratos";
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
  const [params] = useSearchParams();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [info, setInfo] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  // Kept in state so it survives the fresh flow started after a refused attempt.
  const [email, setEmail] = useState("");

  // Kratos sends the browser back with ?flow=<id> when a flow needs more input,
  // e.g. the password that links a Google sign-in to an existing account.
  const flowId = params.get("flow");
  useEffect(() => {
    const load = flowId ? getFlow(kind, flowId) : createFlow(kind);
    load
      .then((f) => {
        setFlow(f);
        // The email Kratos already knows, e.g. from the Google account being linked.
        const known = f.ui.nodes.find((n) => n.attributes.name === "identifier")?.attributes.value;
        if (typeof known === "string" && known !== "") setEmail(known);
        const messages = flowMessages(f);
        setErrors(messages.errors);
        setInfo(messages.info);
      })
      .catch(() => createFlow(kind).then(setFlow, () => setErrors([strings.errors.generic])));
  }, [kind, flowId]);


  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!flow) return;
    const password = String(new FormData(e.currentTarget).get("password"));
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
    setInfo([]);
    // Kratos flows can't be resubmitted after an error; start a fresh one.
    setFlow(await createFlow(kind));
  }

  async function google() {
    if (!flow) return;
    const result = await startProviderSignIn(flow, "google");
    if (!result.ok) setErrors(result.errors);
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
      {info.map((m) => (
        <p key={m} role="status">
          {m}
        </p>
      ))}
      <label>
        {strings.email}
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
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
      <p>{strings.signIn.or}</p>
      <button type="button" onClick={google} disabled={!flow}>
        {strings.signIn.google}
      </button>
    </form>
  );
}

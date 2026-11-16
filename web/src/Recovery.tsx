import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createFlow, getSettingsFlow, sendRecoveryCode, setNewPassword, submitRecoveryCode, type Flow } from "./kratos";
import { useSession } from "./session";
import { strings } from "./strings";

function Errors({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <ul role="alert">
      {errors.map((e) => (
        <li key={e}>{e}</li>
      ))}
    </ul>
  );
}

// Step 1: email; step 2: the code sent by email. The confirmation is the same
// whether or not an account exists, so the page reveals nothing about accounts.
export function Recovery() {
  const [flow, setFlow] = useState<Flow | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    createFlow("recovery").then(setFlow, () => setErrors([strings.errors.generic]));
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!flow) return;
    const data = new FormData(e.currentTarget);
    const result = codeSent
      ? await submitRecoveryCode(flow, String(data.get("code")))
      : await sendRecoveryCode(flow, String(data.get("email")));
    if ("redirectTo" in result) {
      navigate(result.redirectTo, { replace: true });
      return;
    }
    setErrors(result.errors);
    if ("flow" in result) {
      setFlow(result.flow);
      if (result.flow.state === "sent_email") setCodeSent(true);
    }
  }

  return (
    <form onSubmit={submit} noValidate>
      <h2>{strings.recovery.title}</h2>
      <Errors errors={errors} />
      {codeSent ? (
        <>
          <p>{strings.recovery.codeSent}</p>
          <label>
            {strings.recovery.code}
            <input name="code" inputMode="numeric" autoComplete="one-time-code" required />
          </label>
          <button type="submit">{strings.recovery.confirmCode}</button>
        </>
      ) : (
        <>
          <label>
            {strings.email}
            <input name="email" type="email" autoComplete="email" required />
          </label>
          <button type="submit" disabled={!flow}>
            {strings.recovery.sendCode}
          </button>
        </>
      )}
    </form>
  );
}

// Reached from the recovery code, with a short-lived session: set a new password.
export function NewPassword() {
  const [params] = useSearchParams();
  const [flow, setFlow] = useState<Flow | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const { refresh } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    const id = params.get("flow");
    if (!id) {
      navigate("/recuperare", { replace: true });
      return;
    }
    getSettingsFlow(id).then(setFlow, () => navigate("/recuperare", { replace: true }));
  }, [params, navigate]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!flow) return;
    const result = await setNewPassword(flow, String(new FormData(e.currentTarget).get("password")));
    if ("flow" in result && result.errors.length === 0) {
      await refresh();
      navigate("/", { replace: true });
      return;
    }
    if ("redirectTo" in result) {
      navigate(result.redirectTo, { replace: true });
      return;
    }
    setErrors(result.errors.length > 0 ? result.errors : [strings.errors.generic]);
    if ("flow" in result) setFlow(result.flow);
  }

  return (
    <form onSubmit={submit} noValidate>
      <h2>{strings.recovery.newPasswordTitle}</h2>
      <Errors errors={errors} />
      <label>
        {strings.recovery.newPassword}
        <input name="password" type="password" autoComplete="new-password" required />
      </label>
      <p>{strings.signUp.passwordHint}</p>
      <button type="submit" disabled={!flow}>
        {strings.recovery.save}
      </button>
    </form>
  );
}

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteAccount, exportAccount } from "./api";
import { isApp, openExternal, setSessionToken } from "./platform";
import { forgetSession, useSession } from "./session";
import { remove } from "./storage";
import { strings } from "./strings";

const s = strings.account;
export const exportFileName = "examen-caa-date.json";

// "Contul meu": export your data, delete your account (docs/app/features/accounts.md).
export function AccountPage() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  if (!me) return null;

  async function download() {
    setError(undefined);
    try {
      const url = URL.createObjectURL(await exportAccount());
      const a = document.createElement("a");
      a.href = url;
      a.download = exportFileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError(s.exportFailed);
    }
  }

  async function confirmDelete() {
    if (!me) return;
    setBusy(true);
    setError(undefined);
    try {
      await deleteAccount();
    } catch {
      setBusy(false);
      setError(s.deleteFailed);
      return;
    }
    // The device forgets the account and its progress.
    remove(`events:${me.id}`);
    forgetSession();
    setSessionToken(undefined);
    await refresh();
    navigate("/autentificare", { replace: true, state: { notice: s.deleted } });
  }

  return (
    <section className="stack">
      <div className="card">
        <h2>{s.title}</h2>
        <p>
          {strings.home.signedInAs} <strong>{me.email}</strong>
        </p>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="card">
        <h2>{s.exportTitle}</h2>
        <p>{s.exportText}</p>
        {isApp ? (
          <button type="button" onClick={() => openExternal("/cont")}>
            {s.exportOnWebsite}
          </button>
        ) : (
          <button type="button" onClick={download}>
            {s.export}
          </button>
        )}
      </div>
      <div className="card">
        <h2>{s.deleteTitle}</h2>
        <p>{s.deleteText}</p>
        <button type="button" className="danger" onClick={() => (setTyped(""), setConfirming(true))}>
          {s.delete}
        </button>
      </div>
      {confirming && (
        <div className="modal-backdrop">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete"
            onSubmit={(e) => (e.preventDefault(), void confirmDelete())}
          >
            <p id="confirm-delete">{s.confirmText}</p>
            <label>
              {s.confirmLabel}
              <input type="email" autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} />
            </label>
            <div className="actions actions-end">
              <button type="button" onClick={() => setConfirming(false)} disabled={busy}>
                {strings.nav.back}
              </button>
              <button
                type="submit"
                className="danger"
                disabled={busy || typed.trim().toLowerCase() !== me.email.toLowerCase()}
              >
                {s.confirmDelete}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

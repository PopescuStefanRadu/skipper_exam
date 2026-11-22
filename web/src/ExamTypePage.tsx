import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getExamTypes, setExamTypes, type ExamType } from "./api";
import { useSession } from "./session";
import { strings } from "./strings";

export function ExamTypePage() {
  const { profile, refresh } = useSession();
  const navigate = useNavigate();
  const [types, setTypes] = useState<ExamType[]>([]);
  const [selected, setSelected] = useState<string[]>(profile?.examTypes ?? []);
  const [error, setError] = useState("");

  useEffect(() => {
    getExamTypes().then(setTypes, () => setError(strings.errors.generic));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      // Saved in the content's order.
      await setExamTypes(types.filter((t) => selected.includes(t.id)).map((t) => t.id));
      await refresh();
      navigate("/", { replace: true });
    } catch {
      setError(strings.errors.generic);
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <h2>{strings.examType.title}</h2>
      <p className="hint">{strings.examType.several}</p>
      {error && <p role="alert">{error}</p>}
      <fieldset className="options">
        {types.map((t) => (
          <div key={t.id} className="option-card">
            <label className="option">
              <input
                type="checkbox"
                name="examTypes"
                value={t.id}
                disabled={!t.available}
                checked={selected.includes(t.id)}
                onChange={(e) =>
                  setSelected((s) => (e.target.checked ? [...s, t.id] : s.filter((id) => id !== t.id)))
                }
              />
              {t.name}
            </label>
            <p>
              {t.description}
              {!t.available && ` ${strings.examType.notAvailable}`}
            </p>
          </div>
        ))}
      </fieldset>
      <button type="submit" className="primary" disabled={selected.length === 0}>
        {strings.examType.save}
      </button>
    </form>
  );
}

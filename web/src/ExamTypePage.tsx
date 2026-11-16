import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { getExamTypes, setExamType, type ExamType } from "./api";
import { useSession } from "./session";
import { strings } from "./strings";

export function ExamTypePage() {
  const { profile, refresh } = useSession();
  const navigate = useNavigate();
  const [types, setTypes] = useState<ExamType[]>([]);
  const [selected, setSelected] = useState(profile?.examType ?? "");
  const [error, setError] = useState("");

  useEffect(() => {
    getExamTypes().then(setTypes, () => setError(strings.errors.generic));
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await setExamType(selected);
      await refresh();
      navigate("/", { replace: true });
    } catch {
      setError(strings.errors.generic);
    }
  }

  return (
    <form onSubmit={submit} className="card">
      <h2>{strings.examType.title}</h2>
      {error && <p role="alert">{error}</p>}
      <fieldset className="options">
        {types.map((t) => (
          <div key={t.id} className="option-card">
            <label className="option">
              <input
                type="radio"
                name="examType"
                value={t.id}
                disabled={!t.available}
                checked={selected === t.id}
                onChange={() => setSelected(t.id)}
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
      <button type="submit" className="primary" disabled={!selected}>
        {strings.examType.save}
      </button>
    </form>
  );
}

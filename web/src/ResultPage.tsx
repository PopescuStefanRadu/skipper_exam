import { Link, useParams } from "react-router-dom";
import { useContent } from "./content";
import { exams, score } from "./exam";
import { useEvents } from "./events";
import { strings } from "./strings";

const s = strings.exam;

export function ResultPage() {
  const { examId } = useParams();
  const { events } = useEvents();
  const content = useContent();
  const exam = exams(events).find((e) => e.id === examId);
  if (content === undefined) return <p>{strings.loading}</p>;
  if (content === null) return <p role="alert">{s.contentUnavailable}</p>;
  if (!exam || exam.status !== "submitted") return <p role="alert">{s.notFound}</p>;
  const r = score(exam, content);
  return (
    <section className="stack">
      {exam.timedOut && <p className="notice">{s.timedOut}</p>}
      <div className={r.passed ? "verdict pass" : "verdict fail"}>
        <h2>{r.passed ? s.passed : s.failed}</h2>
        <p>{s.score(r.correct, r.total, r.percent, exam.passPercent)}</p>
      </div>
      {r.wrong.length > 0 && (
        <div>
          <h3>{s.wrongAnswers}</h3>
          <ol className="wrong-list">
            {r.wrong.map((w) => (
              <li key={w.question.id} data-testid="wrong-answer" data-question-id={w.question.id}>
                <p className="q">{w.question.text}</p>
                <p className="answer-line given">
                  <span className="mark" aria-hidden="true">
                    ✗
                  </span>
                  <span>
                    {s.yourAnswer} <span data-testid="given">{w.given?.text ?? s.noAnswer}</span>
                  </span>
                </p>
                <p className="answer-line right">
                  <span className="mark" aria-hidden="true">
                    ✓
                  </span>
                  <span>
                    {s.correctAnswer} <strong data-testid="correct">{w.correct.text}</strong>
                  </span>
                </p>
                <Link to={`/intrebare/${w.question.id}`} state={{ given: w.given?.text ?? s.noAnswer }}>
                  {strings.explanation.seeExplanation}
                </Link>
              </li>
            ))}
          </ol>
        </div>
      )}
      <Link to="/" className="button">
        {strings.nav.back}
      </Link>
    </section>
  );
}

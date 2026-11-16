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
    <section>
      {exam.timedOut && <p>{s.timedOut}</p>}
      <h2>{r.passed ? s.passed : s.failed}</h2>
      <p>{s.score(r.correct, r.total, r.percent, exam.passPercent)}</p>
      {r.wrong.length > 0 && (
        <>
          <h3>{s.wrongAnswers}</h3>
          <ol>
            {r.wrong.map((w) => (
              <li key={w.question.id} data-testid="wrong-answer" data-question-id={w.question.id}>
                <p>{w.question.text}</p>
                <p>
                  {s.yourAnswer} <span data-testid="given">{w.given?.text ?? s.noAnswer}</span>
                </p>
                <p>
                  {s.correctAnswer} <strong data-testid="correct">{w.correct.text}</strong>
                </p>
                <Link to={`/intrebare/${w.question.id}`} state={{ given: w.given?.text ?? s.noAnswer }}>
                  {strings.explanation.seeExplanation}
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
      <Link to="/">{strings.nav.back}</Link>
    </section>
  );
}

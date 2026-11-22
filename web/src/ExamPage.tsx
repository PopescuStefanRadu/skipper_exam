import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useContent } from "./content";
import { activeExam, examEvents, type Exam } from "./exam";
import { useEvents } from "./events";
import { strings } from "./strings";

const s = strings.exam;

function formatTime(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  return `${String(m).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

// The current time, updated every second.
function useNow(): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

export function ExamPage() {
  const { events } = useEvents();
  const exam = activeExam(events);
  if (!exam) return <Navigate to="/" replace />;
  return <ExamScreen key={exam.id} exam={exam} />;
}

function ExamScreen({ exam }: { exam: Exam }) {
  const content = useContent();
  const { record } = useEvents();
  const navigate = useNavigate();
  const now = useNow();
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const left = exam.deadline - now;

  function submit(reason: "user" | "timeout") {
    record(
      examEvents.submitted,
      { examId: exam.id, reason },
      reason === "timeout" ? new Date(exam.deadline) : new Date(),
    );
    navigate(`/examen/${exam.id}/rezultat`, { replace: true });
  }

  useEffect(() => {
    if (left <= 0) submit("timeout");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left <= 0]);

  if (content === undefined) return <p>{strings.loading}</p>;
  if (content === null) return <p role="alert">{s.contentUnavailable}</p>;
  const type = content.examTypes.find((t) => t.id === exam.examType);
  const item = exam.questions[index];
  const question = content.questions.find((q) => q.id === item.id);
  const total = exam.questions.length;
  const unanswered = exam.questions.filter((q) => exam.answers[q.id] === undefined).length;

  return (
    <section className="exam">
      {type && (
        <p className="eyebrow" data-testid="exam-name">
          {type.name}
        </p>
      )}
      {type?.format && !type.format.confirmed && <p className="hint">{s.formatNotConfirmed}</p>}
      <div className="card">
        <div className="exam-bar">
          <h2>{s.questionOf(index + 1, total)}</h2>
          <span className={left < 5 * 60_000 ? "timer low" : "timer"}>
            {s.timeLeft} <strong data-testid="time-left">{formatTime(left)}</strong>
          </span>
        </div>
        <div className="bar" aria-hidden="true">
          <span style={{ width: `${((total - unanswered) * 100) / total}%` }} />
        </div>
        {question && (
          <fieldset data-testid="question" data-question-id={question.id}>
            <legend className="question-text">{question.text}</legend>
            <div className="options">
              {item.order.map((i) => (
                <label key={i} className="option">
                  <input
                    type="radio"
                    name={`answer-${question.id}`}
                    checked={exam.answers[question.id] === i}
                    onChange={() =>
                      record(examEvents.answered, {
                        examId: exam.id,
                        questionId: question.id,
                        answer: i,
                      })
                    }
                  />
                  <span>{question.answers[i].text}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <nav className="exam-nav">
          <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            {strings.nav.previous}
          </button>
          <button type="button" disabled={index === total - 1} onClick={() => setIndex(index + 1)}>
            {strings.nav.next}
          </button>
          <button
            type="button"
            className="primary push"
            onClick={() => (unanswered > 0 ? setConfirming(true) : submit("user"))}
          >
            {strings.nav.submit}
          </button>
        </nav>
      </div>
      {confirming && (
        <div className="modal-backdrop">
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="confirm-submit">
            <p id="confirm-submit">{s.unanswered(unanswered)}</p>
            <div className="actions actions-end">
              <button type="button" onClick={() => setConfirming(false)}>
                {strings.nav.back}
              </button>
              <button type="button" className="primary" onClick={() => submit("user")}>
                {strings.nav.submit}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

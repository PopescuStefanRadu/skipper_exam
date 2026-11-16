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
    record(examEvents.submitted, { examId: exam.id, reason }, reason === "timeout" ? new Date(exam.deadline) : new Date());
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
    <section>
      {type?.format && !type.format.confirmed && <p>{s.formatNotConfirmed}</p>}
      <p>
        {s.timeLeft} <strong data-testid="time-left">{formatTime(left)}</strong>
      </p>
      <h2>{s.questionOf(index + 1, total)}</h2>
      {question && (
        <fieldset data-testid="question" data-question-id={question.id}>
          <legend>{question.text}</legend>
          {item.order.map((i) => (
            <div key={i}>
              <label>
                <input
                  type="radio"
                  name={`answer-${question.id}`}
                  checked={exam.answers[question.id] === i}
                  onChange={() => record(examEvents.answered, { examId: exam.id, questionId: question.id, answer: i })}
                />
                {question.answers[i].text}
              </label>
            </div>
          ))}
        </fieldset>
      )}
      <nav>
        <button type="button" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          {strings.nav.previous}
        </button>
        <button type="button" disabled={index === total - 1} onClick={() => setIndex(index + 1)}>
          {strings.nav.next}
        </button>
        <button type="button" onClick={() => (unanswered > 0 ? setConfirming(true) : submit("user"))}>
          {strings.nav.submit}
        </button>
      </nav>
      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-submit">
          <p id="confirm-submit">{s.unanswered(unanswered)}</p>
          <button type="button" onClick={() => setConfirming(false)}>
            {strings.nav.back}
          </button>
          <button type="button" onClick={() => submit("user")}>
            {strings.nav.submit}
          </button>
        </div>
      )}
    </section>
  );
}

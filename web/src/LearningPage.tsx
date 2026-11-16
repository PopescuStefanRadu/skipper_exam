import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ContentPackage, Question } from "./api";
import { useContent } from "./content";
import { useEvents } from "./events";
import { useExplanations } from "./explanations";
import { histories, learningStart, mistakes, practiceEvents, progress, questionsOf, type PracticeMode } from "./learning";
import { Why } from "./QuestionPage";
import { useSession } from "./session";
import { strings } from "./strings";

const s = strings.learning;

// Loads what every learning screen needs: the content and the chosen exam type.
function useLearning(): { content?: ContentPackage | null; examType: string } {
  const content = useContent();
  const { profile } = useSession();
  return { content, examType: profile?.examType ?? "" };
}

// Coverage per subject, with the ways into learning mode and the mistakes.
export function LearningPage() {
  const { content, examType } = useLearning();
  const { events } = useEvents();
  if (content === undefined) return <p>{strings.loading}</p>;
  if (content === null) return <p role="alert">{strings.exam.contentUnavailable}</p>;
  const h = histories(events, content);
  const rows = progress(content, examType, h);
  const passPercent = content.examTypes.find((t) => t.id === examType)?.format?.passPercent ?? 0;
  const toReview = mistakes(content, examType, h).length;

  return (
    <section>
      <h2>{s.title}</h2>
      <p>
        {s.mistakesToReview} <strong data-testid="mistakes-count">{toReview}</strong>
      </p>
      <p className="actions">
        <Link to="/invatare/greseli">{s.practiseMistakes}</Link>
        {rows.length > 1 && <Link to="/invatare/toate">{s.learnAll}</Link>}
      </p>
      <table className="progress">
        <thead>
          <tr>
            <th scope="col">{s.subject}</th>
            <th scope="col">{s.seen}</th>
            <th scope="col">{s.mastered}</th>
            <th scope="col">{s.mistakes}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.subject.id} data-testid="subject" data-subject={r.subject.id}>
              <th scope="row">
                {r.subject.name}
                {r.weak && (
                  <>
                    {" "}
                    <span className="badge badge-weak" title={s.weakHint(passPercent)}>
                      {s.weak}
                    </span>
                  </>
                )}
                <br />
                <Link to={`/invatare/${r.subject.id}`}>{s.learn}</Link>
              </th>
              <td data-testid="seen">{s.of(r.seen, r.total)}</td>
              <td data-testid="mastered">{r.mastered}</td>
              <td data-testid="mistakes">{r.mistakes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>{s.history}</p>
      <Link to="/">{strings.nav.back}</Link>
    </section>
  );
}

// A learning session for one subject, every subject, or the mistakes.
export function PracticePage({ mode }: { mode: PracticeMode }) {
  const { subject } = useParams();
  const { content, examType } = useLearning();
  const { events } = useEvents();
  if (content === undefined) return <p>{strings.loading}</p>;
  if (content === null) return <p role="alert">{strings.exam.contentUnavailable}</p>;
  const h = histories(events, content);

  if (mode === "mistakes") return <Mistakes content={content} examType={examType} />;

  const all = subject === "toate";
  const info = content.subjects.find((x) => x.id === subject);
  const qs = questionsOf(content, examType, all ? undefined : subject);
  if ((!all && !info) || qs.length === 0) return <p role="alert">{s.unknownSubject}</p>;
  return (
    <section>
      <h2>{all ? s.allSubjects : info!.name}</h2>
      <Session key={subject} questions={qs} start={learningStart(qs, h)} mode="learn" />
    </section>
  );
}

// The mistakes as they were when the session started, so the session keeps going
// (and ends with its score) even when every mistake gets answered right.
function Mistakes({ content, examType }: { content: ContentPackage; examType: string }) {
  const { events } = useEvents();
  const [qs] = useState(() => mistakes(content, examType, histories(events, content)));
  return (
    <section>
      <h2>{s.practiseMistakes}</h2>
      {qs.length === 0 ? (
        <>
          <p role="status">{s.noMistakes}</p>
          <Link to="/invatare">{strings.nav.back}</Link>
        </>
      ) : (
        <Session questions={qs} start={0} mode="mistakes" />
      )}
    </section>
  );
}

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Goes through the questions one by one, with immediate feedback. The questions are
// fixed when the session starts. Learning mode wraps around; the mistakes end with a score.
function Session({ questions: initial, start, mode }: { questions: Question[]; start: number; mode: PracticeMode }) {
  const [questions] = useState(initial);
  const [index, setIndex] = useState(start);
  const [given, setGiven] = useState<number>();
  const [right, setRight] = useState(0);
  const { record } = useEvents();
  const { explanations } = useExplanations();
  const q = questions[index];
  const order = useMemo(() => (q ? shuffled(q.answers.length) : []), [q]);

  if (!q) {
    return (
      <>
        <p>{s.sessionDone}</p>
        <p data-testid="session-score">{s.sessionScore(right, questions.length)}</p>
        <Link to="/invatare">{strings.nav.back}</Link>
      </>
    );
  }

  const answered = given !== undefined;
  function choose(i: number) {
    if (answered) return;
    const correct = q.answers[i].correct;
    setGiven(i);
    if (correct) setRight(right + 1);
    record(practiceEvents.answered, { questionId: q.id, answer: i, correct, mode });
  }
  function next() {
    setGiven(undefined);
    setIndex(mode === "learn" ? (index + 1) % questions.length : index + 1);
  }

  return (
    <>
      <p>{s.questionOf(index + 1, questions.length)}</p>
      <fieldset data-testid="question" data-question-id={q.id}>
        <legend>{q.text}</legend>
        {order.map((i) => {
          const a = q.answers[i];
          const mark = !answered ? "" : a.correct ? "answer-correct" : i === given ? "answer-wrong" : "";
          return (
            <div key={i} className={mark}>
              <label>
                <input type="radio" name={`answer-${q.id}`} checked={given === i} disabled={answered} onChange={() => choose(i)} />
                {a.text}
              </label>
            </div>
          );
        })}
      </fieldset>
      {answered && (
        <div aria-live="polite">
          <p className={q.answers[given].correct ? "feedback-right" : "feedback-wrong"} data-testid="feedback">
            {q.answers[given].correct ? s.right : s.wrong}
          </p>
          <p>
            {strings.explanation.correctAnswer} <strong data-testid="correct">{q.answers.find((a) => a.correct)?.text}</strong>
          </p>
          {explanations === undefined ? (
            <p>{strings.loading}</p>
          ) : (
            <Why e={explanations.find((x) => x.questionId === q.id)} />
          )}
          <nav>
            <button type="button" onClick={next}>
              {strings.nav.next}
            </button>
          </nav>
        </div>
      )}
      <p>
        <Link to="/invatare">{strings.nav.back}</Link>
      </p>
    </>
  );
}

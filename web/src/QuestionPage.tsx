import { useState, type FormEvent } from "react";
import { useLocation, useParams } from "react-router-dom";
import { postReview, ReviewError, type Explanation, type ReviewAction, type Passage } from "./api";
import { useContent } from "./content";
import { useExplanations } from "./explanations";
import { useSession } from "./session";
import { uuid } from "./storage";
import { strings } from "./strings";

const s = strings.explanation;

// A question with its correct answer and its explanation. Reached from a wrong
// answer on an exam result, which passes the answer given.
export function QuestionPage() {
  const { questionId } = useParams();
  const given = (useLocation().state as { given?: string } | null)?.given;
  const content = useContent();
  const { explanations } = useExplanations();
  const { me } = useSession();
  if (content === undefined || explanations === undefined) return <p>{strings.loading}</p>;
  const question = content?.questions.find((q) => q.id === questionId);
  if (!question) return <p role="alert">{s.unknownQuestion}</p>;
  const e = explanations.find((x) => x.questionId === question.id);
  const reviewer = me?.roles?.includes("reviewer") ?? false;

  return (
    <section>
      <h2 data-testid="question-text">{question.text}</h2>
      {given !== undefined && (
        <p>
          {s.yourAnswer} <span data-testid="given">{given}</span>
        </p>
      )}
      <p>
        {s.correctAnswer} <strong data-testid="correct">{question.answers.find((a) => a.correct)?.text}</strong>
      </p>
      <Why e={e} />
      {reviewer && <ReviewPanel questionId={question.id} e={e} />}
    </section>
  );
}

// Why the correct answer is correct: the explanation, unless rejected by a reviewer.
export function Why({ e }: { e?: Explanation }) {
  const shown = e && e.status !== "rejected" ? e : undefined;
  return (
    <>
      <h3>{s.why}</h3>
      {e?.flagged && <p role="status">{s.flagged}</p>}
      {shown ? <ExplanationView e={shown} /> : <p>{s.none}</p>}
    </>
  );
}

function ExplanationView({ e }: { e: Explanation }) {
  const verified = e.status === "verified";
  return (
    <figure>
      <p>
        <span className={`badge ${verified ? "badge-verified" : "badge-unverified"}`}>{verified ? s.verified : s.unverified}</span>
        {!verified && ` ${s.unverifiedHint}`}
      </p>
      <blockquote data-testid="quote">{e.quote}</blockquote>
      <figcaption data-testid="reference">
        {e.sourceTitle}, {e.reference}, {s.page(e.page)}
      </figcaption>
      <a href={`/api/sources/${e.source}#page=${e.page}`} target="_blank" rel="noreferrer">
        {s.openSource} {s.atPage(e.page)}
      </a>
    </figure>
  );
}

const r = strings.review;

function ReviewPanel({ questionId, e }: { questionId: string; e?: Explanation }) {
  const { explanations, update } = useExplanations();
  const [form, setForm] = useState<"correct" | "flag" | null>(null);
  const [error, setError] = useState("");
  const proposed = e && e.status !== "verified" && e.status !== "rejected";

  async function send(action: ReviewAction, extra: { note?: string; correction?: Passage } = {}) {
    setError("");
    try {
      update(await postReview({ id: uuid(), questionId, action, ...extra }));
      setForm(null);
    } catch (err) {
      setError(err instanceof ReviewError && err.status === 422 ? r.quoteNotOnPage : r.failed);
    }
  }

  // Documents explanations can quote: the ones current explanations use.
  const sources = [...new Map((explanations ?? []).map((x) => [x.source, x.sourceTitle])).entries()];

  return (
    <aside aria-label={r.title}>
      <h3>{r.title}</h3>
      {e?.concern && (
        <p>
          {r.concern} {e.concern}
        </p>
      )}
      {e?.note && (
        <p>
          {r.note} {e.note}
        </p>
      )}
      {e?.flagged && e.flagNote && (
        <p>
          {r.flagNote} {e.flagNote}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="actions">
        {proposed && (
          <>
            <button type="button" onClick={() => send("confirm")}>
              {r.confirm}
            </button>
            <button type="button" onClick={() => send("reject")}>
              {r.reject}
            </button>
          </>
        )}
        <button type="button" onClick={() => setForm("correct")}>
          {r.correct}
        </button>
        <button type="button" onClick={() => setForm("flag")}>
          {r.flag}
        </button>
        {(e?.status === "verified" || e?.status === "rejected" || e?.flagged) && (
          <button type="button" onClick={() => send("reset")}>
            {r.undo}
          </button>
        )}
      </div>
      {form === "correct" && (
        <CorrectionForm sources={sources} initial={e} onSave={(correction) => send("correct", { correction })} />
      )}
      {form === "flag" && <FlagForm onSend={(note) => send("flag", { note })} />}
    </aside>
  );
}

function CorrectionForm({
  sources,
  initial,
  onSave,
}: {
  sources: [string, string][];
  initial?: Passage;
  onSave: (p: Passage) => void;
}) {
  const [source, setSource] = useState(initial?.source ?? sources[0]?.[0] ?? "");
  const [page, setPage] = useState(String(initial?.page ?? 1));
  const [reference, setReference] = useState(initial?.reference ?? "");
  const [quote, setQuote] = useState(initial?.quote ?? "");
  function submit(ev: FormEvent) {
    ev.preventDefault();
    onSave({ source, page: Number(page), reference, quote });
  }
  return (
    <form onSubmit={submit}>
      <label>
        {r.document}
        <select value={source} onChange={(ev) => setSource(ev.target.value)}>
          {sources.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
      </label>
      <label>
        {r.page}
        <input type="number" min={1} value={page} onChange={(ev) => setPage(ev.target.value)} required />
      </label>
      <label>
        {r.reference}
        <input value={reference} onChange={(ev) => setReference(ev.target.value)} required />
      </label>
      <label>
        {r.quote}
        <textarea value={quote} onChange={(ev) => setQuote(ev.target.value)} rows={5} required />
      </label>
      <button type="submit">{r.saveCorrection}</button>
    </form>
  );
}

function FlagForm({ onSend }: { onSend: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        onSend(note);
      }}
    >
      <label>
        {r.whatsWrong}
        <textarea value={note} onChange={(ev) => setNote(ev.target.value)} rows={3} required />
      </label>
      <button type="submit">{r.sendFlag}</button>
    </form>
  );
}

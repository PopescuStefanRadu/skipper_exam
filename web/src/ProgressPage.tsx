import { useState } from "react";
import { Link } from "react-router-dom";
import { useContent } from "./content";
import { useEvents } from "./events";
import { useSession } from "./session";
import { attempts, practice, recentCount, summary, type Attempt } from "./stats";
import { strings } from "./strings";

const s = strings.progress;
const trendCount = 20;

const dateTime = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" });
const shortDate = new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "short" });

function Stat({ id, value, label }: { id: string; value: string | number; label: string }) {
  return (
    <div className="stat">
      <strong data-testid={id}>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

// The last exams' scores as bars, oldest on the left, with the pass mark as a line.
function Trend({ list, typeName }: { list: Attempt[]; typeName: (id: string) => string }) {
  const shown = list.filter((a) => a.result).slice(0, trendCount).reverse();
  const pass = Math.max(...shown.map((a) => a.exam.passPercent));
  return (
    <div className="card">
      <h3>{s.trendTitle}</h3>
      <p className="hint">{s.trendHint(shown.length)}</p>
      <div className="chart" role="list">
        <div className="pass-line" style={{ bottom: `${pass}%` }} aria-hidden="true">
          <span>{s.passLine(pass)}</span>
        </div>
        {shown.map((a) => {
          const label = s.bar(dateTime.format(a.exam.startedAt), typeName(a.exam.examType), a.result!.percent);
          return (
            <div key={a.exam.id} className="bar-slot" role="listitem" aria-label={label} title={label}>
              <div className="bar" data-testid="score-bar" style={{ height: `${Math.max(a.result!.percent, 1)}%` }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function History({ list, typeName }: { list: Attempt[]; typeName: (id: string) => string }) {
  return (
    <div className="card">
      <h3>{s.historyTitle}</h3>
      <ul className="attempts">
        {list.map((a) => (
          <li key={a.exam.id} data-testid="attempt" data-exam-id={a.exam.id}>
            <div className="attempt-main">
              <span className="attempt-when">{dateTime.format(a.exam.startedAt)}</span>
              <span className="attempt-type">{typeName(a.exam.examType)}</span>
            </div>
            {a.result ? (
              <div className="attempt-score">
                <span className={a.result.passed ? "badge pass" : "badge fail"}>
                  {a.result.passed ? strings.exam.passed : strings.exam.failed}
                </span>
                <span>{s.attemptScore(a.result.correct, a.result.total, a.result.percent)}</span>
                <span className="hint">
                  {s.minutes(a.minutes)}
                  {a.exam.timedOut && `, ${s.timedOut}`}
                </span>
                <Link to={`/examen/${a.exam.id}/rezultat`}>{strings.exam.seeResult}</Link>
              </div>
            ) : (
              <div className="attempt-score">
                <span className="badge">{s.abandoned}</span>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Activity() {
  const { events } = useEvents();
  const p = practice(events);
  const max = Math.max(1, ...p.perDay.map((d) => d.answers));
  return (
    <div className="card">
      <h2>{s.practiceTitle}</h2>
      <div className="stat-row">
        <Stat id="stat-practice" value={p.answers} label={s.practiceAnswers} />
        <Stat
          id="stat-practice-right"
          value={p.answers ? s.passedOf(p.right, Math.round((p.right * 100) / p.answers)) : 0}
          label={s.practiceRight}
        />
        <Stat id="stat-streak" value={p.streak} label={s.streak} />
      </div>
      <h3>{s.activityTitle}</h3>
      <div className="chart activity" role="list">
        {p.perDay.map((d) => {
          const label = s.activityBar(shortDate.format(d.day), d.answers);
          return (
            <div key={d.day.toISOString()} className="bar-slot" role="listitem" aria-label={label} title={label}>
              <div
                className={d.answers ? "bar" : "bar empty"}
                data-testid="activity-bar"
                style={{ height: d.answers ? `${(d.answers * 100) / max}%` : undefined }}
              />
            </div>
          );
        })}
      </div>
      <div className="chart-axis" aria-hidden="true">
        <span>{shortDate.format(p.perDay[0].day)}</span>
        <span>{s.today}</span>
      </div>
      <Link to="/invatare">{s.seeCoverage}</Link>
    </div>
  );
}

// Past exams and practice, with the figures that say how the preparation goes.
export function ProgressPage() {
  const content = useContent();
  const { events } = useEvents();
  const { profile } = useSession();
  const [filter, setFilter] = useState("");
  if (content === undefined) return <p>{strings.loading}</p>;
  if (content === null) return <p role="alert">{strings.exam.contentUnavailable}</p>;

  const typeName = (id: string) => content.examTypes.find((t) => t.id === id)?.name ?? id;
  const everything = attempts(events, content);
  // The filter offers the chosen exam types and any other type the user took exams of.
  const typeIds = [...new Set([...(profile?.examTypes ?? []), ...everything.map((a) => a.exam.examType)])];
  const list = filter ? everything.filter((a) => a.exam.examType === filter) : everything;
  const sum = summary(list);

  return (
    <section className="stack">
      <h2>{s.title}</h2>
      {typeIds.length > 1 && (
        <label className="filter">
          {s.filter}
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">{s.allTypes}</option>
            {typeIds.map((id) => (
              <option key={id} value={id}>
                {typeName(id)}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="card">
        <h2>{s.examsTitle}</h2>
        {sum ? (
          <div className="stat-row">
            <Stat id="stat-exams" value={sum.taken} label={s.taken} />
            <Stat id="stat-passed" value={s.passedOf(sum.passed, sum.passRate)} label={s.passed} />
            <Stat id="stat-average" value={`${sum.recentAverage}%`} label={s.recentAverage(Math.min(recentCount, sum.taken))} />
            <Stat id="stat-best" value={`${sum.best}%`} label={s.best} />
          </div>
        ) : (
          <>
            <p>{s.none}</p>
            <Link to="/" className="button primary">
              {s.startOne}
            </Link>
          </>
        )}
      </div>
      {sum && <Trend list={list} typeName={typeName} />}
      {list.length > 0 && <History list={list} typeName={typeName} />}
      <Activity />
    </section>
  );
}

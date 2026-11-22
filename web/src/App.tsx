import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AccountPage } from "./AccountPage";
import { ContentProvider, useContent } from "./content";
import { activeExam, examEvents, newExam } from "./exam";
import { ExamPage } from "./ExamPage";
import { EventsProvider, useEvents } from "./events";
import { ExplanationsProvider } from "./explanations";
import { QuestionPage } from "./QuestionPage";
import { ExamTypePage } from "./ExamTypePage";
import { histories, mistakes, progress } from "./learning";
import { LearningPage, PracticePage } from "./LearningPage";
import { App as NativeApp } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { finishAppSignIn, signOut, startSignIn } from "./signin";
import { appReturnUrl, isApp } from "./platform";
import { ResultPage } from "./ResultPage";
import { ServerStatus } from "./ServerStatus";
import { uuid } from "./storage";
import { forgetSession, SessionProvider, useSession } from "./session";
import { strings } from "./strings";

export function App() {
  return (
    <SessionProvider>
      <ContentProvider>
        {isApp && <AppLinks />}
        <header className="topbar">
          <div className="topbar-inner">
            <Link to="/" className="brand">
              <span className="brand-mark" aria-hidden="true">
                ⚓
              </span>
              <h1>{strings.appTitle}</h1>
            </Link>
            <AccountBar />
          </div>
        </header>
        <main className="page">
          <Routes>
            <Route path="/autentificare" element={<SignIn />} />
            {/* Addresses from before sign-in moved to the sign-in service. */}
            {["/inregistrare", "/recuperare", "/setari"].map((path) => (
              <Route key={path} path={path} element={<Navigate to="/autentificare" replace />} />
            ))}
            <Route
              path="/cont"
              element={
                <RequireSession>
                  <AccountPage />
                </RequireSession>
              }
            />
            <Route
              path="/tip-examen"
              element={
                <RequireSession>
                  <ExamTypePage />
                </RequireSession>
              }
            />
            <Route
              path="/examen"
              element={
                <RequireSession>
                  <RequireExamType>
                    <ExamPage />
                  </RequireExamType>
                </RequireSession>
              }
            />
            <Route
              path="/examen/:examId/rezultat"
              element={
                <RequireSession>
                  <ResultPage />
                </RequireSession>
              }
            />
            <Route
              path="/invatare"
              element={
                <RequireSession>
                  <RequireExamType>
                    <LearningPage />
                  </RequireExamType>
                </RequireSession>
              }
            />
            <Route
              path="/invatare/greseli"
              element={
                <RequireSession>
                  <RequireExamType>
                    <PracticePage mode="mistakes" />
                  </RequireExamType>
                </RequireSession>
              }
            />
            <Route
              path="/invatare/:subject"
              element={
                <RequireSession>
                  <RequireExamType>
                    <PracticePage mode="learn" />
                  </RequireExamType>
                </RequireSession>
              }
            />
            <Route
              path="/intrebare/:questionId"
              element={
                <RequireSession>
                  <QuestionPage />
                </RequireSession>
              }
            />
            <Route
              path="*"
              element={
                <RequireSession>
                  <RequireExamType>
                    <Home />
                  </RequireExamType>
                </RequireSession>
              }
            />
          </Routes>
        </main>
        <footer className="footer">
          <ServerStatus />
        </footer>
      </ContentProvider>
    </SessionProvider>
  );
}

// Android: the app is opened through appReturnUrl at the end of a sign-in in the
// browser.
function AppLinks() {
  const { refresh } = useSession();
  const navigate = useNavigate();
  useEffect(() => {
    const listener = NativeApp.addListener("appUrlOpen", async ({ url }) => {
      if (!url.startsWith(appReturnUrl)) return;
      await Browser.close().catch(() => undefined);
      if (await finishAppSignIn(url)) {
        await refresh();
        navigate("/", { replace: true });
      } else {
        navigate("/autentificare?eroare=1", { replace: true });
      }
    });
    return () => {
      void listener.then((l) => l.remove());
    };
  }, [refresh, navigate]);
  return null;
}

// Signed-out pages: the app's purpose and one form in a card.
function AuthPage({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <p className="lead">{strings.appSubtitle}</p>
      <div className="card">{children}</div>
    </div>
  );
}

// There is no guest mode: everything except the sign-in pages needs an account.
function RequireSession({ children }: { children: ReactNode }) {
  const { me } = useSession();
  if (me === undefined) return <p>{strings.loading}</p>;
  if (me === null) return <Navigate to="/autentificare" replace />;
  return (
    <EventsProvider key={me.id} userId={me.id}>
      <ExplanationsProvider>
        {children}
        <SyncStatus />
      </ExplanationsProvider>
    </EventsProvider>
  );
}

// Whether everything done on this device has reached the server.
function SyncStatus() {
  const { pending } = useEvents();
  return (
    <p className="hint sync-status" data-testid="sync-status" data-pending={pending}>
      {pending === 0 ? strings.sync.done : strings.sync.pending(pending)}
    </p>
  );
}

// Practice depends on the exam types, so they're chosen before anything else.
function RequireExamType({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const location = useLocation();
  if (!profile?.examTypes?.length) return <Navigate to="/tip-examen" replace state={{ from: location.pathname }} />;
  return children;
}

function AccountBar() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  if (!me) return null;
  return (
    <div className="account">
      <span className="account-label">{strings.home.signedInAs}</span>
      <Link to="/cont" className="account-email" title={strings.home.myAccount} aria-label={strings.home.myAccount}>
        <span data-testid="signed-in-email">{me.email}</span>
      </Link>
      <button
        type="button"
        onClick={async () => {
          await signOut();
          forgetSession();
          await refresh();
          navigate("/autentificare", { replace: true });
        }}
      >
        {strings.home.signOut}
      </button>
    </div>
  );
}

function SignIn() {
  const { me } = useSession();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice;
  const failed = new URLSearchParams(location.search).has("eroare");
  const [busy, setBusy] = useState(false);
  if (me) return <Navigate to="/" replace />;
  return (
    <AuthPage>
      {notice && <p className="notice">{notice}</p>}
      <h2>{strings.signIn.title}</h2>
      {failed && <p role="alert">{strings.signIn.failed}</p>}
      <p>{strings.signIn.intro}</p>
      <button
        type="button"
        className="primary wide"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await startSignIn();
          // The app stays on this page while the browser is open.
          if (isApp) setBusy(false);
        }}
      >
        {strings.signIn.google}
      </button>
    </AuthPage>
  );
}

function Home() {
  const { profile } = useSession();
  const content = useContent();
  const { events, record } = useEvents();
  const navigate = useNavigate();
  const [expired, setExpired] = useState<string>();
  const active = activeExam(events);
  const chosen = profile?.examTypes ?? [];
  const types = content?.examTypes.filter((t) => chosen.includes(t.id)) ?? [];
  // An unfinished exam stays reachable even if its type is no longer chosen.
  const activeType = content?.examTypes.find((t) => t.id === active?.examType);
  const examTypes = activeType && !types.includes(activeType) ? [...types, activeType] : types;

  // An exam whose time ran out while the user was away is submitted as it was.
  const activeExpired = active !== undefined && active.deadline <= Date.now();
  useEffect(() => {
    if (!active || !activeExpired) return;
    record(examEvents.submitted, { examId: active.id, reason: "timeout" }, new Date(active.deadline));
    setExpired(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, activeExpired]);

  function start(examTypeId: string) {
    if (!content) return;
    const id = uuid();
    record(examEvents.started, newExam(content, examTypeId, id));
    navigate("/examen");
  }

  const h = content ? histories(events, content) : undefined;
  const coverage = content && h && chosen.length ? progress(content, chosen, h) : [];
  const seen = coverage.reduce((n, r) => n + r.seen, 0);
  const total = coverage.reduce((n, r) => n + r.total, 0);
  const toReview = content && h && chosen.length ? mistakes(content, chosen, h).length : 0;
  const running = active && !activeExpired;

  return (
    <section className="stack">
      <div className="card">
        <p className="eyebrow">{strings.home.preparingFor}</p>
        <div className="actions split">
          <div className="exam-types">
            {(content ? types.map((t) => t.name) : chosen).map((name) => (
              <strong key={name} data-testid="exam-type" className="big">
                {name}
              </strong>
            ))}
          </div>
          <Link to="/tip-examen">{strings.home.changeExamType}</Link>
        </div>
      </div>
      {content === null && <p role="alert">{strings.exam.contentUnavailable}</p>}
      {expired && (
        <p className="notice">
          {strings.exam.expiredWhileAway} <Link to={`/examen/${expired}/rezultat`}>{strings.exam.seeResult}</Link>
        </p>
      )}

      {examTypes.map((t) => {
        const format = t.format;
        const title = strings.home.examTitleFor(t.name);
        return (
          <section key={t.id} className="card" aria-label={title}>
            <h2>{examTypes.length > 1 ? title : strings.home.examTitle}</h2>
            {format && (
              <>
                <p>{strings.exam.format(format.questions, format.minutes, format.passPercent)}</p>
                {!format.confirmed && <p className="hint">{strings.exam.formatNotConfirmed}</p>}
              </>
            )}
            {running && active.examType === t.id && (
              <>
                <p className="info">{strings.exam.unfinished}</p>
                <div className="actions">
                  <button type="button" className="primary" onClick={() => navigate("/examen")}>
                    {strings.exam.resume}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => record(examEvents.abandoned, { examId: active.id })}
                  >
                    {strings.exam.abandon}
                  </button>
                </div>
              </>
            )}
            {running && active.examType !== t.id && <p className="hint">{strings.exam.finishOtherFirst}</p>}
            {!running && format && (
              <button type="button" className="primary" onClick={() => start(t.id)}>
                {strings.exam.start}
              </button>
            )}
          </section>
        );
      })}

      <div className="card">
        <h2>{strings.home.learningTitle}</h2>
        {total > 0 && (
          <div className="stat-row">
            <div className="stat">
              <strong>{strings.learning.of(seen, total)}</strong>
              <span>{strings.home.questionsSeen}</span>
            </div>
            <div className="stat">
              <strong>{toReview}</strong>
              <span>{strings.home.toReview}</span>
            </div>
          </div>
        )}
        <Link to="/invatare" className="button primary">
          {strings.home.openLearning}
        </Link>
      </div>
    </section>
  );
}

import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AuthForm } from "./AuthForm";
import { ContentProvider, useContent } from "./content";
import { activeExam, examEvents, newExam } from "./exam";
import { ExamPage } from "./ExamPage";
import { EventsProvider, useEvents } from "./events";
import { ExplanationsProvider } from "./explanations";
import { QuestionPage } from "./QuestionPage";
import { ExamTypePage } from "./ExamTypePage";
import { histories, mistakes, progress } from "./learning";
import { LearningPage, PracticePage } from "./LearningPage";
import { signOut } from "./kratos";
import { NewPassword, Recovery } from "./Recovery";
import { ResultPage } from "./ResultPage";
import { ServerStatus } from "./ServerStatus";
import { uuid } from "./storage";
import { SessionProvider, useSession } from "./session";
import { strings } from "./strings";

export function App() {
  return (
    <SessionProvider>
      <ContentProvider>
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
            <Route path="/inregistrare" element={<SignUp />} />
            <Route
              path="/recuperare"
              element={
                <AuthPage>
                  <Recovery />
                </AuthPage>
              }
            />
            <Route
              path="/setari"
              element={
                <AuthPage>
                  <NewPassword />
                </AuthPage>
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
      <ExplanationsProvider>{children}</ExplanationsProvider>
    </EventsProvider>
  );
}

// Practice depends on the exam type, so it's chosen before anything else.
function RequireExamType({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const location = useLocation();
  if (!profile?.examType) return <Navigate to="/tip-examen" replace state={{ from: location.pathname }} />;
  return children;
}

function AccountBar() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  if (!me) return null;
  return (
    <div className="account">
      <span className="account-label">{strings.home.signedInAs}</span>
      <span className="account-email" data-testid="signed-in-email" title={me.email}>
        {me.email}
      </span>
      <button
        type="button"
        onClick={async () => {
          await signOut();
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
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  if (me) return <Navigate to="/" replace />;
  return (
    <AuthPage>
      <AuthForm
        kind="login"
        title={strings.signIn.title}
        submitLabel={strings.signIn.submit}
        onSuccess={async () => {
          await refresh();
          navigate("/", { replace: true });
        }}
      />
      <div className="auth-links">
        <p>
          <Link to="/recuperare">{strings.signIn.forgotPassword}</Link>
        </p>
        <p>
          {strings.signIn.noAccount} <Link to="/inregistrare">{strings.signIn.toSignUp}</Link>
        </p>
      </div>
    </AuthPage>
  );
}

function SignUp() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  if (me) return <Navigate to="/" replace />;
  return (
    <AuthPage>
      <AuthForm
        kind="registration"
        title={strings.signUp.title}
        submitLabel={strings.signUp.submit}
        passwordHint={strings.signUp.passwordHint}
        onSuccess={async () => {
          await refresh();
          navigate("/", { replace: true });
        }}
      />
      <div className="auth-links">
        <p>
          {strings.signUp.haveAccount} <Link to="/autentificare">{strings.signUp.toSignIn}</Link>
        </p>
      </div>
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
  const examType = content?.examTypes.find((t) => t.id === profile?.examType);
  const format = examType?.format;

  // An exam whose time ran out while the user was away is submitted as it was.
  const activeExpired = active !== undefined && active.deadline <= Date.now();
  useEffect(() => {
    if (!active || !activeExpired) return;
    record(examEvents.submitted, { examId: active.id, reason: "timeout" }, new Date(active.deadline));
    setExpired(active.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, activeExpired]);

  function start() {
    if (!content || !examType) return;
    const id = uuid();
    record(examEvents.started, newExam(content, examType.id, id));
    navigate("/examen");
  }

  const h = content ? histories(events, content) : undefined;
  const coverage = content && h && examType ? progress(content, examType.id, h) : [];
  const seen = coverage.reduce((n, r) => n + r.seen, 0);
  const total = coverage.reduce((n, r) => n + r.total, 0);
  const toReview = content && h && examType ? mistakes(content, examType.id, h).length : 0;

  return (
    <section className="stack">
      <div className="card">
        <p className="eyebrow">{strings.home.preparingFor}</p>
        <div className="actions split">
          <strong data-testid="exam-type" className="big">
            {examType?.name ?? profile?.examType}
          </strong>
          <Link to="/tip-examen">{strings.home.changeExamType}</Link>
        </div>
      </div>
      {content === null && <p role="alert">{strings.exam.contentUnavailable}</p>}

      <div className="card">
        <h2>{strings.home.examTitle}</h2>
        {format && (
          <>
            <p>{strings.exam.format(format.questions, format.minutes, format.passPercent)}</p>
            {!format.confirmed && <p className="hint">{strings.exam.formatNotConfirmed}</p>}
          </>
        )}
        {expired && (
          <p className="notice">
            {strings.exam.expiredWhileAway} <Link to={`/examen/${expired}/rezultat`}>{strings.exam.seeResult}</Link>
          </p>
        )}
        {active && !activeExpired ? (
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
        ) : (
          format && (
            <button type="button" className="primary" onClick={start}>
              {strings.exam.start}
            </button>
          )
        )}
      </div>

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

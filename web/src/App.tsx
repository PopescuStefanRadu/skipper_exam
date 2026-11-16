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
      <main>
        <h1>{strings.appTitle}</h1>
        <p>{strings.appSubtitle}</p>
        <Routes>
          <Route path="/autentificare" element={<SignIn />} />
          <Route path="/inregistrare" element={<SignUp />} />
          <Route path="/recuperare" element={<Recovery />} />
          <Route path="/setari" element={<NewPassword />} />
          <Route path="/tip-examen" element={<RequireSession><ExamTypePage /></RequireSession>} />
          <Route path="/examen" element={<RequireSession><RequireExamType><ExamPage /></RequireExamType></RequireSession>} />
          <Route path="/examen/:examId/rezultat" element={<RequireSession><ResultPage /></RequireSession>} />
          <Route path="/intrebare/:questionId" element={<RequireSession><QuestionPage /></RequireSession>} />
          <Route path="*" element={<RequireSession><RequireExamType><Home /></RequireExamType></RequireSession>} />
        </Routes>
        <ServerStatus />
      </main>
      </ContentProvider>
    </SessionProvider>
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
        <AccountBar />
        {children}
      </ExplanationsProvider>
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
  return (
    <header>
      <p>
        {strings.home.signedInAs} <strong data-testid="signed-in-email">{me?.email}</strong>
      </p>
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
    </header>
  );
}

function SignIn() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  if (me) return <Navigate to="/" replace />;
  return (
    <>
      <AuthForm
        kind="login"
        title={strings.signIn.title}
        submitLabel={strings.signIn.submit}
        onSuccess={async () => {
          await refresh();
          navigate("/", { replace: true });
        }}
      />
      <p>
        <Link to="/recuperare">{strings.signIn.forgotPassword}</Link>
      </p>
      <p>
        {strings.signIn.noAccount} <Link to="/inregistrare">{strings.signIn.toSignUp}</Link>
      </p>
    </>
  );
}

function SignUp() {
  const { me, refresh } = useSession();
  const navigate = useNavigate();
  if (me) return <Navigate to="/" replace />;
  return (
    <>
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
      <p>
        {strings.signUp.haveAccount} <Link to="/autentificare">{strings.signUp.toSignIn}</Link>
      </p>
    </>
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

  return (
    <section>
      <p>
        {strings.home.preparingFor} <strong data-testid="exam-type">{examType?.name ?? profile?.examType}</strong>
      </p>
      <Link to="/tip-examen">{strings.home.changeExamType}</Link>
      {content === null && <p role="alert">{strings.exam.contentUnavailable}</p>}
      {format && (
        <>
          <p>{strings.exam.format(format.questions, format.minutes, format.passPercent)}</p>
          {!format.confirmed && <p>{strings.exam.formatNotConfirmed}</p>}
        </>
      )}
      {expired && (
        <p>
          {strings.exam.expiredWhileAway} <Link to={`/examen/${expired}/rezultat`}>{strings.exam.seeResult}</Link>
        </p>
      )}
      {active && !activeExpired ? (
        <div>
          <p>{strings.exam.unfinished}</p>
          <button type="button" onClick={() => navigate("/examen")}>
            {strings.exam.resume}
          </button>
          <button type="button" onClick={() => record(examEvents.abandoned, { examId: active.id })}>
            {strings.exam.abandon}
          </button>
        </div>
      ) : (
        format && (
          <button type="button" onClick={start}>
            {strings.exam.start}
          </button>
        )
      )}
    </section>
  );
}

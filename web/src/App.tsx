import { useEffect, useState, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { getExamTypes, type ExamType } from "./api";
import { AuthForm } from "./AuthForm";
import { ExamTypePage } from "./ExamTypePage";
import { signOut } from "./kratos";
import { NewPassword, Recovery } from "./Recovery";
import { ServerStatus } from "./ServerStatus";
import { SessionProvider, useSession } from "./session";
import { strings } from "./strings";

export function App() {
  return (
    <SessionProvider>
      <main>
        <h1>{strings.appTitle}</h1>
        <p>{strings.appSubtitle}</p>
        <Routes>
          <Route path="/autentificare" element={<SignIn />} />
          <Route path="/inregistrare" element={<SignUp />} />
          <Route path="/recuperare" element={<Recovery />} />
          <Route path="/setari" element={<NewPassword />} />
          <Route path="/tip-examen" element={<RequireSession><ExamTypePage /></RequireSession>} />
          <Route path="*" element={<RequireSession><RequireExamType><Home /></RequireExamType></RequireSession>} />
        </Routes>
        <ServerStatus />
      </main>
    </SessionProvider>
  );
}

// There is no guest mode: everything except the sign-in pages needs an account.
function RequireSession({ children }: { children: ReactNode }) {
  const { me } = useSession();
  if (me === undefined) return <p>{strings.loading}</p>;
  if (me === null) return <Navigate to="/autentificare" replace />;
  return (
    <>
      <AccountBar />
      {children}
    </>
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
  const [types, setTypes] = useState<ExamType[]>([]);
  useEffect(() => {
    getExamTypes().then(setTypes, () => setTypes([]));
  }, []);
  const examType = types.find((t) => t.id === profile?.examType);
  return (
    <section>
      <p>
        {strings.home.preparingFor} <strong data-testid="exam-type">{examType?.name ?? profile?.examType}</strong>
      </p>
      <Link to="/tip-examen">{strings.home.changeExamType}</Link>
    </section>
  );
}

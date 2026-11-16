// All interface text lives here. The interface is in Romanian, except short
// navigation words (Next, Previous, Back, Submit), which stay in English.
export const strings = {
  appTitle: "Examen CAA",
  appSubtitle: "Pregătire pentru examenul de conducător de ambarcațiune de agrement",
  serverStatus: "Stare server",
  serverChecking: "Se verifică…",
  serverOk: "Conectat",
  serverUnavailable: "Serverul nu este disponibil",

  email: "Email",
  password: "Parolă",
  signIn: {
    title: "Autentificare",
    submit: "Intră în cont",
    noAccount: "Nu ai cont?",
    toSignUp: "Creează un cont",
    forgotPassword: "Ai uitat parola?",
    google: "Continuă cu Google",
    or: "sau",
    linkGoogle: "Există deja un cont cu acest email. Intră cu parola contului pentru a-l lega de Google.",
  },
  recovery: {
    title: "Recuperare parolă",
    sendCode: "Trimite codul",
    codeSent: "Dacă există un cont cu acest email, ți-am trimis un cod.",
    code: "Cod",
    confirmCode: "Confirmă codul",
    newPasswordTitle: "Parolă nouă",
    newPassword: "Parolă nouă",
    save: "Salvează parola",
  },
  signUp: {
    title: "Creare cont",
    submit: "Creează contul",
    haveAccount: "Ai deja cont?",
    toSignIn: "Autentifică-te",
    passwordHint: "Cel puțin 8 caractere.",
  },
  home: {
    signedInAs: "Conectat ca",
    signOut: "Ieșire din cont",
  },
  loading: "Se încarcă…",

  errors: {
    invalidCredentials: "Emailul sau parola nu sunt corecte.",
    emailTaken: "Există deja un cont cu acest email.",
    passwordTooShort: "Parola trebuie să aibă cel puțin 8 caractere.",
    passwordTooSimilar: "Parola seamănă prea mult cu emailul.",
    invalidEmail: "Adresa de email nu este validă.",
    required: "Completează toate câmpurile.",
    expired: "Formularul a expirat. Încearcă din nou.",
    invalidCode: "Codul nu este corect sau a expirat.",
    generic: "A apărut o eroare. Încearcă din nou.",
  },
} as const;

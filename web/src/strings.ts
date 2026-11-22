// All interface text lives here. The interface is in Romanian, except short
// navigation words (Next, Previous, Back, Submit), which stay in English.
export const strings = {
  appTitle: "Examen CAA",
  appSubtitle: "Pregătire pentru examenul de conducător de ambarcațiune de agrement",
  serverStatus: "Stare server",
  serverChecking: "Se verifică…",
  serverOk: "Conectat",
  serverUnavailable: "Serverul nu este disponibil",

  signIn: {
    title: "Autentificare",
    intro: "Intră cu contul Google. Prima autentificare îți creează contul.",
    google: "Continuă cu Google",
    failed: "Autentificarea nu a reușit. Încearcă din nou.",
  },
  home: {
    signedInAs: "Conectat ca",
    signOut: "Ieșire din cont",
    preparingFor: "Te pregătești pentru:",
    changeExamType: "Schimbă examenele",
    examTitle: "Examen simulat",
    examTitleFor: (name: string) => `Examen simulat: ${name}`,
    learningTitle: "Învățare",
    questionsSeen: "întrebări văzute",
    toReview: "de recapitulat",
    openLearning: "Învățare și progres",
    myAccount: "Contul meu",
  },
  account: {
    title: "Contul meu",
    exportTitle: "Datele tale",
    exportText:
      "Descarcă un fișier cu tot ce păstrează aplicația despre tine: contul, examenele alese, răspunsurile și examenele date.",
    export: "Descarcă datele mele",
    exportOnWebsite: "Descarcă datele pe site",
    exportFailed: "Datele nu au putut fi descărcate. Încearcă din nou când ai conexiune.",
    deleteTitle: "Ștergerea contului",
    deleteText: "Contul și tot progresul tău se șterg definitiv. Nu se pot recupera.",
    delete: "Șterge contul",
    confirmText: "Ștergi definitiv contul și tot progresul? Acțiunea nu poate fi anulată.",
    confirmLabel: "Scrie emailul contului pentru confirmare",
    confirmDelete: "Șterge definitiv",
    deleteFailed: "Contul nu a putut fi șters. Încearcă din nou când ai conexiune.",
    deleted: "Contul tău a fost șters.",
  },
  exam: {
    format: (questions: number, minutes: number, passPercent: number) =>
      `${questions} de întrebări, ${minutes} de minute, promovare de la ${passPercent}%`,
    formatNotConfirmed: "Formatul examenului nu este confirmat oficial.",
    start: "Începe examenul",
    unfinished: "Ai un examen neterminat.",
    resume: "Continuă examenul",
    abandon: "Renunță la examen",
    finishOtherFirst: "Termină sau renunță mai întâi la examenul început.",
    expiredWhileAway: "Timpul examenului neterminat a expirat.",
    seeResult: "Vezi rezultatul",
    questionOf: (n: number, total: number) => `Întrebarea ${n} din ${total}`,
    timeLeft: "Timp rămas",
    unanswered: (n: number) =>
      `Ai ${n} ${n === 1 ? "întrebare" : n < 20 ? "întrebări" : "de întrebări"} fără răspuns. ${n === 1 ? "Aceasta va fi considerată greșită" : "Acestea vor fi considerate greșite"}.`,
    passed: "Admis",
    failed: "Respins",
    score: (correct: number, total: number, percent: number, passPercent: number) =>
      `${correct} din ${total} de răspunsuri corecte (${percent}%). Pragul de promovare este ${passPercent}%.`,
    timedOut: "Timpul a expirat.",
    wrongAnswers: "Răspunsuri greșite",
    yourAnswer: "Răspunsul tău:",
    correctAnswer: "Răspunsul corect:",
    noAnswer: "Fără răspuns",
    notFound: "Examenul nu a fost găsit.",
    contentUnavailable: "Întrebările nu au putut fi încărcate. Verifică conexiunea și încearcă din nou.",
  },
  explanation: {
    seeExplanation: "Vezi explicația",
    correctAnswer: "Răspunsul corect:",
    yourAnswer: "Răspunsul tău:",
    why: "De ce",
    none: "Nu există încă o explicație pentru această întrebare.",
    unverified: "Neverificată",
    unverifiedHint: "Pasajul a fost propus automat și nu a fost încă verificat.",
    verified: "Verificată",
    page: (n: number) => `pagina ${n}`,
    openSource: "Deschide documentul",
    atPage: (n: number) => `la pagina ${n}`,
    flagged: "Întrebarea este în curs de verificare.",
    unknownQuestion: "Întrebarea nu a fost găsită.",
  },
  review: {
    title: "Verificare",
    concern: "Posibilă contradicție:",
    note: "Notă:",
    flagNote: "Semnalare:",
    confirm: "Confirmă",
    reject: "Respinge",
    correct: "Corectează",
    flag: "Semnalează",
    undo: "Anulează",
    document: "Document",
    page: "Pagina",
    reference: "Referința",
    quote: "Citatul",
    saveCorrection: "Salvează corectura",
    whatsWrong: "Ce pare greșit?",
    sendFlag: "Trimite semnalarea",
    quoteNotOnPage: "Citatul nu se găsește pe pagina indicată.",
    failed: "Nu s-a putut salva. Verifică conexiunea și încearcă din nou.",
  },
  learning: {
    title: "Învățare",
    subject: "Subiect",
    seen: "Văzute",
    mastered: "Știute",
    mistakes: "Greșite",
    of: (n: number, total: number) => `${n} din ${total}`,
    weak: "Punct slab",
    weakHint: (passPercent: number) => `Sub ${passPercent}% din întrebările văzute sunt știute.`,
    learn: "Învață",
    learnAll: "Învață toate subiectele",
    allSubjects: "Toate subiectele",
    practiseMistakes: "Practică greșelile",
    mistakesToReview: "Întrebări de recapitulat:",
    noMistakes: "Nu ai greșeli de recapitulat.",
    unknownSubject: "Subiectul nu a fost găsit.",
    questionOf: (n: number, total: number) => `Întrebarea ${n} din ${total}`,
    right: "Corect!",
    wrong: "Greșit.",
    sessionScore: (correct: number, total: number) => `Ai răspuns corect la ${correct} din ${total}.`,
    sessionDone: "Ai terminat recapitularea.",
    history:
      "Toate răspunsurile, din examene și din învățare, contează. Întrebările echivalente sunt numărate o singură dată.",
  },
  sync: {
    done: "Toate datele sunt salvate pe server.",
    pending: (n: number) =>
      `${n} ${n === 1 ? "modificare așteaptă" : n < 20 ? "modificări așteaptă" : "de modificări așteaptă"} conexiunea cu serverul.`,
  },
  nav: {
    next: "Next",
    previous: "Previous",
    submit: "Submit",
    back: "Back",
  },
  examType: {
    title: "Pentru ce examene te pregătești?",
    several: "Poți alege mai multe.",
    notAvailable: "Nu este disponibil încă.",
    save: "Salvează",
  },
  // The privacy policy and terms (docs/app/features/legal.md). Keep them true to
  // what the app does: change them when the data kept or its use changes.
  legal: {
    privacyLink: "Confidențialitate",
    termsLink: "Termeni",
    updated: (date: string) => `Ultima actualizare: ${date}`,
    updatedOn: "22 noiembrie 2026",
    company: {
      name: "SRP HYPERPLAY S.R.L.",
      office: "București, Sectorul 2, Strada Fabrica de Gheață nr. 10, bl. 91, sc. A, et. 3, ap. 13",
      cui: "49509067",
      registry: "J40/2040/01.02.2024",
      euid: "ROONRC.J40/2040/2024",
      email: "popescustefanradu@gmail.com",
    },
    operator: (c: { name: string; office: string; cui: string; registry: string; euid: string; email: string }) => [
      `${c.name}, cu sediul social în ${c.office}, CUI ${c.cui}, înregistrată la Registrul Comerțului sub nr. ${c.registry} (EUID ${c.euid}).`,
      `Contact: ${c.email}`,
    ],
    privacy: {
      title: "Politica de confidențialitate",
      intro:
        "Aplicația Examen CAA te ajută să te pregătești pentru examenul de conducător de ambarcațiune de agrement. Aici afli ce date păstrăm despre tine, de ce și ce drepturi ai.",
      sections: [
        {
          title: "Cine răspunde de datele tale",
          body: ["Operatorul datelor cu caracter personal este:", "@operator"],
        },
        {
          title: "Ce date păstrăm",
          body: [
            [
              "Contul: adresa de email și identificatorul contului tău la serviciul de autentificare esrp.ro, primite când intri cu Google. Numele din contul Google nu îl păstrăm.",
              "Ce faci în aplicație: examenele pentru care te pregătești, răspunsurile date în modul de învățare și în examenele simulate, cu data și ora lor, și, dacă ești recenzent, deciziile tale despre explicații.",
              "Sesiunea: un cod aleator care te ține conectat, păstrat pe server doar ca amprentă (hash), într-un cookie strict necesar (skipper_session). Nu folosim cookie-uri de analiză sau de publicitate și nu te urmărim pe alte site-uri.",
              "Pe dispozitivul tău: contul, întrebările și progresul care încă nu a ajuns pe server, în memoria browserului sau a aplicației, ca aplicația să meargă și fără internet.",
            ],
            "Serverul care găzduiește aplicația poate păstra jurnale tehnice (de exemplu adresa IP și ora unei cereri) pentru securitate și funcționare, pentru o perioadă limitată.",
          ],
        },
        {
          title: "De ce și pe ce temei",
          body: [
            [
              "Ca să îți oferim serviciul: contul, progresul pe orice dispozitiv, examenele simulate și recapitularea greșelilor (executarea contractului, art. 6 alin. (1) lit. b din GDPR).",
              "Ca aplicația să fie sigură și să funcționeze corect (interes legitim, art. 6 alin. (1) lit. f din GDPR).",
            ],
            "Nu vindem datele, nu le folosim pentru publicitate și nu luăm decizii automate cu efecte juridice asupra ta.",
          ],
        },
        {
          title: "Unde sunt și cine le vede",
          body: [
            "Datele sunt păstrate pe servere aflate în România. Nu le transmitem altor firme.",
            "Când intri cu Google, Google îți confirmă identitatea ca operator separat, după propria politică de confidențialitate (policies.google.com/privacy).",
          ],
        },
        {
          title: "Cât timp le păstrăm",
          body: [
            "Cât timp ai cont. Dacă îți ștergi contul, datele se șterg imediat; din copiile de siguranță zilnice dispar în cel mult 14 zile. Deciziile recenzenților despre explicații rămân, pentru că de ele depind explicațiile pe care le văd toți, dar nu mai sunt legate de cont.",
          ],
        },
        {
          title: "Drepturile tale",
          body: [
            "Ai dreptul să îți accesezi datele, să ceri corectarea sau ștergerea lor, restricționarea prelucrării, portabilitatea lor și să te opui prelucrării bazate pe interesul legitim.",
            [
              "Exportul datelor: pe pagina „Contul meu”, „Descarcă datele mele” descarcă tot ce păstrăm despre tine.",
              "Ștergerea contului: pe aceeași pagină, „Șterge contul” șterge contul și tot progresul.",
            ],
            "Pentru orice altă cerere scrie-ne la adresa de contact de mai sus; răspundem în cel mult o lună.",
            "Poți depune o plângere la Autoritatea Națională de Supraveghere a Prelucrării Datelor cu Caracter Personal (ANSPDCP), www.dataprivacy.ro.",
          ],
        },
        {
          title: "Modificări",
          body: [
            "Dacă schimbăm ce date păstrăm sau cum le folosim, actualizăm această pagină și data de mai sus.",
          ],
        },
      ],
    },
    terms: {
      title: "Termeni și condiții",
      intro:
        "Folosind aplicația Examen CAA, pe site sau pe Android, ești de acord cu acești termeni.",
      sections: [
        {
          title: "Cine oferă aplicația",
          body: ["@operator"],
        },
        {
          title: "Ce este aplicația",
          body: [
            "Un ajutor gratuit pentru pregătirea examenului de conducător de ambarcațiune de agrement: examene simulate, învățare pe subiecte și explicații cu trimiteri la surse.",
            "Aplicația nu este afiliată cu Autoritatea Navală Română (ANR) sau cu Registrul Naval Român (RNA). Întrebările provin din listele publicate de RNA, care, după cum precizează RNA, sunt doar o parte din întrebările de examen. Formatul examenului simulat nu este confirmat oficial.",
          ],
        },
        {
          title: "Fără garanții",
          body: [
            "Facem tot posibilul ca întrebările și explicațiile să fie corecte, dar pot conține greșeli. Sursa de referință rămân reglementările oficiale. Promovarea examenelor simulate nu garantează promovarea examenului real.",
            "Aplicația este oferită „așa cum este”. În limitele permise de lege, nu răspundem pentru pagube rezultate din folosirea ei sau din imposibilitatea de a o folosi.",
          ],
        },
        {
          title: "Contul tău",
          body: [
            "Intri cu contul Google, prin serviciul de autentificare esrp.ro. Contul este personal: nu îl împărți cu alții. Îți poți exporta datele sau șterge contul oricând, de pe pagina „Contul meu”.",
          ],
        },
        {
          title: "Folosire corectă",
          body: [
            "Nu încerca să perturbi funcționarea aplicației, să accesezi conturile altora sau să copiezi automat conținutul ei. Putem suspenda conturile folosite astfel.",
          ],
        },
        {
          title: "Date personale",
          body: ["Cum folosim datele tale este descris în Politica de confidențialitate."],
        },
        {
          title: "Modificări și legea aplicabilă",
          body: [
            "Putem modifica acești termeni; versiunea în vigoare este cea de pe această pagină, cu data ultimei actualizări. Termenii sunt guvernați de legea română.",
            "Întrebări sau sesizări: scrie-ne la adresa de contact de mai sus.",
          ],
        },
      ],
    },
  },
  loading: "Se încarcă…",

  errors: {
    generic: "A apărut o eroare. Încearcă din nou.",
  },
} as const;

# Privacy policy and terms

## Behaviour

- The app has a **privacy policy** (`/confidentialitate`, "Politica de confidențialitate") and **terms of use** (`/termeni`, "Termeni și condiții"), in Romanian. Both are readable without an account, on the website and in the Android app, and are linked from the footer of every page, including the sign-in page. Google's and Authentik's sign-in screens, and a future Play Store listing, link to the privacy policy too.
- The operator and data controller is **SRP HYPERPLAY S.R.L.**, identified as Legea 365/2002 (art. 5) and the GDPR (art. 13) require: registered office, CUI, trade register number and EUID, and a contact address. The company details live in one place in `web/src/strings.ts` (`legal.company`).
- The privacy policy says what the app actually keeps, and must change when that changes:
  - from the sign-in service: the account's ID at the sign-in service and the email; the name Google sends isn't stored;
  - what the user does: the chosen exam types, answers in learning mode and in exams (with their time), and, for reviewers, their review decisions;
  - the session: a random token, kept only as a hash on the server, in a cookie that is strictly necessary (`skipper_session`); no analytics or advertising cookies, no trackers;
  - on the device: the account, the content and the progress waiting to sync, in the browser's or the app's local storage.
  It also gives the purposes and legal bases (providing the service, contract; security, legitimate interest), where the data is stored (servers in Romania), who receives it (nobody else; Google signs you in as a controller of its own), how long it's kept (until the account is deleted; nightly backups disappear within 14 days after that), and the user's rights, with the export and deletion on the "Contul meu" page and the right to complain to ANSPDCP.
- The terms say the app is a free study aid, not affiliated with ANR or RNA; the questions come from the lists RNA publishes, which are only part of the exam questions; explanations can contain mistakes, and passing the simulated exams doesn't guarantee passing the real one. They cover the account (one per person, through Google), acceptable use, liability, changes to the terms, Romanian law, and the contact address.
- Each page shows the date it was last updated.

## E2E scenarios

Main paths:
- Signed out, the sign-in page links to the privacy policy and the terms; both open without an account and name SRP HYPERPLAY S.R.L. with its CUI and the contact address.
- Signed in, the footer links to both pages too, and the user can go back to the app from them.

Less common paths:
- Opening `/confidentialitate` or `/termeni` directly, signed out, shows the page instead of sending you to sign in.

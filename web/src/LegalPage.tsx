import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { strings } from "./strings";

const s = strings.legal;

// A paragraph's text, with the contact address and the privacy policy's name as links.
function rich(text: string): ReactNode {
  const escape = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const esrp = "https://esrp.ro/privacy";
  const parts = text.split(new RegExp(`(${escape(s.company.email)}|${escape(s.privacy.title)}|${escape(esrp)})`));
  return parts.map((part, i) =>
    part === s.company.email ? (
      <a key={i} href={`mailto:${part}`}>
        {part}
      </a>
    ) : part === esrp ? (
      <a key={i} href={part}>
        {part.replace("https://", "")}
      </a>
    ) : part === s.privacy.title ? (
      <Link key={i} to="/confidentialitate">
        {part}
      </Link>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

type Body = readonly (string | readonly string[])[];

function Section({ title, body }: { title: string; body: Body }) {
  return (
    <>
      <h3>{title}</h3>
      {body.map((b, i) =>
        typeof b !== "string" ? (
          <ul key={i}>
            {b.map((item) => (
              <li key={item}>{rich(item)}</li>
            ))}
          </ul>
        ) : b === "@operator" ? (
          <address key={i} className="operator">
            {s.operator(s.company).map((line) => (
              <p key={line}>{rich(line)}</p>
            ))}
          </address>
        ) : (
          <p key={i}>{rich(b)}</p>
        ),
      )}
    </>
  );
}

// The privacy policy or the terms: readable by anyone, signed in or not.
export function LegalPage({ page }: { page: "privacy" | "terms" }) {
  const doc = s[page];
  return (
    <article className="card legal">
      <h2>{doc.title}</h2>
      <p className="hint">{s.updated(s.updatedOn)}</p>
      <p>{doc.intro}</p>
      {doc.sections.map((sec) => (
        <Section key={sec.title} title={sec.title} body={sec.body} />
      ))}
    </article>
  );
}

export function LegalLinks() {
  return (
    <nav className="legal-links" aria-label={s.privacyLink}>
      <Link to="/confidentialitate">{s.privacyLink}</Link>
      <span aria-hidden="true">·</span>
      <Link to="/termeni">{s.termsLink}</Link>
    </nav>
  );
}

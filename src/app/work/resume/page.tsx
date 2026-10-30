import type { Metadata } from "next";
import Link from "next/link";
import { buttonClasses } from "@/components/Button";
import { SITE } from "@/lib/site";
import { PROJECTS, RESUME, STATE_LABEL } from "@/lib/work";

// The printable résumé. `npm run resume` prints this page to public/work/tyler-flores-resume.pdf.
// Same data as /work, so the page and the PDF never disagree. Unlisted, like /work.
export const metadata: Metadata = {
  // absolute: the root layout's template would otherwise append the site name.
  title: { absolute: `${RESUME.name} · Résumé` },
  description: RESUME.headline,
  robots: { index: false, follow: false },
};

export default function ResumePage() {
  // Shown lowercase: email addresses are case-insensitive, and it reads shorter.
  const email = RESUME.email.toLowerCase();
  // Narrow screens get a phone gutter and a stacked header; from sm up, and always on paper
  // (the PDF lays out at 8.5in, past sm), it is the Letter layout.
  return (
    <main id="main" className="mx-auto max-w-[8.5in] px-5 py-[0.4in] text-[10.5pt] leading-[1.4] text-ink-2 print:text-[9pt] sm:px-[0.6in] print:px-[0.6in]">
      <nav aria-label="Résumé" className="-mx-3 mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/work" className={buttonClasses("ghost", "px-3")}>
          <span aria-hidden="true">←</span> Portfolio
        </Link>
        <a href={RESUME.pdf} download className={buttonClasses("ghost", "px-3")}>
          Download PDF
        </a>
      </nav>
      <header className="flex flex-col gap-3 border-b border-line-2 pb-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6 print:flex-row print:items-end print:justify-between print:gap-6">
        <div>
          <h1 className="text-[22pt] font-normal leading-none tracking-[-0.03em] text-ink">{RESUME.name}</h1>
          <p className="mt-1.5 text-[10.5pt] text-pretty text-ink-2">{RESUME.headline}</p>
        </div>
        <p className="text-[10.5pt] text-ink-2 print:text-[9pt] sm:shrink-0 sm:text-right print:shrink-0 print:text-right">
          <a href={`mailto:${email}`} className="text-ink">{email}</a>
          <br />
          {RESUME.region} · open to remote work
          <br />
          <a href={`${SITE.url}/work`} className="text-ink">{SITE.domain}/work</a>
        </p>
      </header>

      <section aria-labelledby="r-projects" className="mt-4">
        <h2 id="r-projects" className="font-mono text-[8pt] uppercase tracking-[0.12em] text-muted">Projects</h2>
        <ol className="mt-1.5 grid gap-2">
          {PROJECTS.map((p) => (
            <li key={p.id} className="break-inside-avoid">
              <p className="text-ink">
                <span className="font-semibold">{p.name}</span>
                <span className="text-muted"> · {STATE_LABEL[p.state]}{p.href ? ` · ${new URL(p.href).host}` : ""}</span>
              </p>
              <p>{p.line}</p>
              {p.stats && <p className="text-ink">{p.stats.items.map((s) => `${s.value} ${s.label}`).join(" · ")}.</p>}
              <ul className="mt-0.5 grid gap-0.5">
                {p.built.slice(0, 2).map((b) => (
                  <li key={b} className="grid grid-cols-[0.8em_minmax(0,1fr)]">
                    <span aria-hidden="true">–</span>
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-0.5 text-[8.5pt] text-muted">{p.stack.join(" · ")}</p>
            </li>
          ))}
        </ol>
      </section>

      {RESUME.experience.length > 0 && (
        <section aria-labelledby="r-exp" className="mt-4 break-inside-avoid">
          <h2 id="r-exp" className="font-mono text-[8pt] uppercase tracking-[0.12em] text-muted">Experience</h2>
          {RESUME.experience.map((j) => (
            <div key={j.title} className="mt-1.5">
              <p className="text-ink">
                <span className="font-semibold">{j.title}</span>
                <span className="text-muted"> · {j.org}{j.years ? ` · ${j.years}` : ""}</span>
              </p>
              <ul className="mt-0.5 grid gap-0.5">
                {j.lines.map((l) => (
                  <li key={l} className="grid grid-cols-[0.8em_minmax(0,1fr)]">
                    <span aria-hidden="true">–</span>
                    <span>{l}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="r-skills" className="mt-4 break-inside-avoid">
        <h2 id="r-skills" className="font-mono text-[8pt] uppercase tracking-[0.12em] text-muted">Skills</h2>
        <dl className="mt-1.5 grid gap-0.5">
          {RESUME.skills.map((s) => (
            <div key={s.group} className="grid grid-cols-[9.5em_minmax(0,1fr)]">
              <dt className="font-semibold text-ink">{s.group}</dt>
              <dd>{s.items.join(" · ")}</dd>
            </div>
          ))}
        </dl>
      </section>

      {RESUME.certs.length > 0 && (
        <section aria-labelledby="r-certs" className="mt-4 break-inside-avoid">
          <h2 id="r-certs" className="font-mono text-[8pt] uppercase tracking-[0.12em] text-muted">Certifications and training</h2>
          <p className="mt-1.5">{RESUME.certs.join(" · ")}</p>
        </section>
      )}
    </main>
  );
}

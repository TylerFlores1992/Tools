import type { Metadata } from "next";
import { SITE } from "@/lib/site";
import { PROJECTS, RESUME, STATE_LABEL } from "@/lib/work";

// The printable résumé. `npm run resume` prints this page to public/work/tyler-flores-resume.pdf.
// Same data as /work, so the page and the PDF never disagree. Unlisted, like /work.
export const metadata: Metadata = {
  title: `${RESUME.name}: résumé`,
  description: RESUME.headline,
  robots: { index: false, follow: false },
};

export default function ResumePage() {
  return (
    <main id="main" className="mx-auto max-w-[8.5in] px-[0.6in] py-[0.4in] text-[9pt] leading-[1.4] text-ink-2">
      <header className="flex items-end justify-between gap-6 border-b border-line-2 pb-3">
        <div>
          <h1 className="text-[22pt] font-normal leading-none tracking-[-0.03em] text-ink">{RESUME.name}</h1>
          <p className="mt-1.5 text-[10.5pt] text-ink-2">{RESUME.headline}</p>
        </div>
        <p className="shrink-0 text-right text-[9pt] text-ink-2">
          <a href={`mailto:${RESUME.email}`} className="text-ink">{RESUME.email}</a>
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

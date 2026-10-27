import type { Metadata } from "next";
import Image from "next/image";
import { Arrow, buttonClasses } from "@/components/Button";
import { Label } from "@/components/Label";
import { PageTransition } from "@/components/PageTransition";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { State } from "@/components/State";
import { HOW_I_WORK, PROJECTS, RESUME, STATE_LABEL, type Project } from "@/lib/work";

// Unlisted (owner's call, 2026-10-26): shared by link, never in the nav, sitemap or search.
export const metadata: Metadata = {
  title: `${RESUME.name}: work`,
  description: RESUME.headline,
  robots: { index: false, follow: false },
};

function Stats({ stats }: { stats: NonNullable<Project["stats"]> }) {
  return (
    <div className="self-start rounded-card border border-line bg-surface p-6 shadow-card sm:p-8">
      <p className="font-mono text-label uppercase text-muted">By the numbers</p>
      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-7">
        {stats.items.map((s) => (
          <div key={s.label} className="flex flex-col-reverse">
            <dt className="mt-1 text-small text-ink-2">{s.label}</dt>
            <dd className="text-title font-normal tabular-nums text-ink">{s.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-7 text-small text-muted">Counted from CampHawk&rsquo;s own records, {stats.asOf}.</p>
    </div>
  );
}

function ProjectBlock({ p, n }: { p: Project; n: number }) {
  return (
    <article aria-labelledby={`p-${p.id}`} className="grid gap-8 border-t border-line-2 py-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-14">
      <div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-label uppercase">
          <span className="tabular-nums text-muted">{String(n).padStart(2, "0")}</span>
          {p.state === "live" ? <State kind="ok">{STATE_LABEL[p.state]}</State> : <State kind="note">{STATE_LABEL[p.state]}</State>}
        </div>
        <h3 id={`p-${p.id}`} className="mt-4 text-h2 font-normal">{p.name}</h3>
        <p className="mt-3 max-w-[60ch] text-lede text-ink-2">{p.line}</p>
        <p className="mt-6 font-mono text-label uppercase text-muted">The problem</p>
        <p className="mt-2 max-w-[64ch] text-body text-ink-2">{p.problem}</p>
        <p className="mt-6 font-mono text-label uppercase text-muted">What I built</p>
        <ul className="mt-2 grid max-w-[64ch] gap-2 text-body text-ink-2">
          {p.built.map((b) => (
            <li key={b} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2">
              <span aria-hidden="true" className="text-muted">–</span>
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <ul aria-label="Built with" className="mt-6 flex flex-wrap gap-1.5">
          {p.stack.map((s) => (
            <li key={s} className="rounded-tag border border-line-2 px-2 py-1 font-mono text-label text-ink-2">{s}</li>
          ))}
        </ul>
        {p.href && (
          <a href={p.href} className={buttonClasses("quiet", "mt-8")}>
            Visit {new URL(p.href).host} <Arrow />
          </a>
        )}
      </div>
      {(p.shot || p.stats) && (
        <div className="grid gap-6 self-start">
          {p.shot && (
            <figure>
              <Image src={p.shot.src} alt={p.shot.alt} width={p.shot.w} height={p.shot.h} sizes="(min-width: 1024px) 50vw, 100vw" className="w-full rounded-card border border-line shadow-card" />
              {p.shot.note && <figcaption className="mt-3 text-small text-muted">{p.shot.note}</figcaption>}
            </figure>
          )}
          {p.stats && <Stats stats={p.stats} />}
        </div>
      )}
    </article>
  );
}

export default function WorkPage() {
  const contact = RESUME.email ? `mailto:${RESUME.email}` : null;
  return (
    <>
      <SiteHeader current={null} />
      <main id="main" className="mx-auto max-w-[1280px] px-5 pb-24 pt-10 sm:px-12 sm:pt-16 3xl:max-w-[1600px]">
        <PageTransition>
          <header className="max-w-[900px]">
            <Label rule>Work</Label>
            <h1 className="mt-4 text-title font-normal">{RESUME.name}</h1>
            <p className="mt-5 max-w-[60ch] text-lede text-ink-2">{RESUME.headline}</p>
            {RESUME.region && <p className="mt-3 text-small text-muted">{RESUME.region} · open to remote work</p>}
            <div className="mt-8 flex flex-wrap gap-3">
              {contact && (
                <a href={contact} className={buttonClasses("primary")}>
                  Email {RESUME.email} <Arrow />
                </a>
              )}
              <a href={RESUME.pdf} download className={buttonClasses("quiet")}>
                Download résumé (PDF)
              </a>
            </div>
          </header>

          <section aria-labelledby="how" className="mt-20">
            <h2 id="how" className="font-mono text-label uppercase text-muted">How I work</h2>
            <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {HOW_I_WORK.map((h, i) => (
                <li key={h.title} className="rounded-card border border-line bg-surface p-5 shadow-card">
                  <span className="font-mono text-label tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-3 text-h3 font-medium">{h.title}</h3>
                  <p className="mt-2 text-small text-ink-2">{h.body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="projects" className="mt-20">
            <h2 id="projects" className="font-mono text-label uppercase text-muted">Projects</h2>
            <div className="mt-6">
              {PROJECTS.map((p, i) => <ProjectBlock key={p.id} p={p} n={i + 1} />)}
            </div>
          </section>

          {RESUME.experience.length > 0 && (
            <section aria-labelledby="experience" className="mt-12 border-t border-line-2 pt-12">
              <h2 id="experience" className="font-mono text-label uppercase text-muted">Experience</h2>
              <ol className="mt-6 grid gap-8">
                {RESUME.experience.map((j) => (
                  <li key={`${j.title}-${j.org}`} className="grid gap-2 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8">
                    <span className="font-mono text-label uppercase tabular-nums text-muted md:pt-1">{j.years ?? "Union crew"}</span>
                    <div>
                      <h3 className="text-h3 font-medium">{j.title}</h3>
                      <p className="text-body text-ink-2">{j.org}</p>
                      <ul className="mt-2 grid max-w-[64ch] gap-1.5 text-body text-ink-2">
                        {j.lines.map((l) => <li key={l}>{l}</li>)}
                      </ul>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section aria-labelledby="skills" className="mt-12 border-t border-line-2 pt-12">
            <h2 id="skills" className="font-mono text-label uppercase text-muted">Skills</h2>
            <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
              {RESUME.skills.map((s) => (
                <div key={s.group}>
                  <dt className="text-h3 font-medium">{s.group}</dt>
                  <dd className="mt-2">
                    <ul className="grid gap-1 text-small text-ink-2">
                      {s.items.map((it) => <li key={it}>{it}</li>)}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          {RESUME.certs.length > 0 && (
            <section aria-labelledby="certs" className="mt-12 border-t border-line-2 pt-12">
              <h2 id="certs" className="font-mono text-label uppercase text-muted">Certifications and training</h2>
              <ul className="mt-6 grid gap-1.5 text-body text-ink-2">
                {RESUME.certs.map((c) => <li key={c}>{c}</li>)}
              </ul>
            </section>
          )}
        </PageTransition>
      </main>
      <SiteFooter />
    </>
  );
}

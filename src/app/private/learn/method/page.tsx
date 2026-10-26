import type { Metadata } from "next";
import { Label } from "@/components/Label";
import { requirePrivate } from "@/lib/money/guard";
import { BOX_DAYS, CHECKPOINT_PASS, REVIEW_PER_DAY } from "@/tools/learn/check";
import { LearnShell } from "@/tools/learn/ui/LearnShell";

export const metadata: Metadata = {
  title: "How it teaches",
  description: "The research behind the Learn lessons.",
  robots: { index: false, follow: false },
};

/**
 * Why the course is built the way it is, from the research done on 2026-10-26
 * (docs/LEARN.md keeps the long version). Every rule here is in the code: change one, change both.
 */
const RULES: { title: string; body: string; source: { label: string; href: string }[] }[] = [
  {
    title: "Read and trace before you write",
    body: "In a study of 941 students across several universities, the weak spot was reading code, not writing it, and students who traced line by line did better. So every lesson is about reading: predicting, tracing and judging code. Writing comes in small changes only.",
    source: [{ label: "Lister et al. 2004", href: "https://www.cs.auckland.ac.nz/~j-hamer/ITiCSE04-wg.pdf" }],
  },
  {
    title: "One tracing method, used every time",
    body: "Learners taught an explicit way to trace (a table of each variable's value, updated line by line) got about 15% more right after just minutes of instruction. That's the \"Trace\" step: a tracing table you fill in.",
    source: [{ label: "Xie et al. 2018", href: "https://faculty.washington.edu/ajko/papers/Xie2018TracingStrategies.pdf" }],
  },
  {
    title: "Predict, run, investigate, modify",
    body: "PRIMM orders a lesson as: predict what code does, see it run, look into how, change it, then make something. Each lesson here runs the same way: a worked example, a prediction, a trace, putting lines in order, finding a bug, changing code and running it, then explaining it.",
    source: [{ label: "PRIMM summary (Raspberry Pi Foundation)", href: "https://static.raspberrypi.org/files/curriculum/quickreads/11-Pedagogy_Summary_PRIMM_V4_2023.pdf" }],
  },
  {
    title: "Worked examples with labeled steps",
    body: "Examples whose parts are labeled with what they're FOR (\"running total starts here\") cut withdrawals and failures in a 265-student course. The ▸ notes inside the reading steps are those labels, and the five-step way of reading a new function in 1.11 is the routine they build to.",
    source: [{ label: "Margulieux et al. 2020", href: "https://neverworkintheory.org/2023/03/10/reducing-withdrawal-and-failure-rates-with-labeled-subgoals.html" }],
  },
  {
    title: "Explain the purpose, not each line",
    body: "Novices who could say what code is FOR in plain English were the stronger programmers; line-by-line recitals weren't. The Explain steps ask for the purpose first, and the AI marker is told not to credit a recital.",
    source: [{ label: "Lister et al. 2006", href: "https://www.cs.auckland.ac.nz/courses/compsci747s2c/lectures/p118-lister.pdf" }],
  },
  {
    title: "AI gives hints, not answers",
    body: "In a large high-school study, students with an unrestricted AI tutor scored 48% higher in practice but 17% lower on the real exam; a hint-only tutor avoided the harm. AI marking of explanations also runs generous. So Gemini marks each point and hints at what's missing, and the model answer only shows once you've covered every point or ask for it.",
    source: [
      { label: "Bastani et al. (Wharton)", href: "https://knowledge.wharton.upenn.edu/article/without-guardrails-generative-ai-can-harm-education" },
      { label: "Azaiz et al. 2024", href: "https://arxiv.org/html/2403.04449v1" },
    ],
  },
  {
    title: "Spaced, mixed review",
    body: `Remembering something after a gap works better than rereading it, and the best gap grows with how long you need to remember. Every answer goes into five boxes: right moves it up, wrong sends it back to the first. Gaps are ${BOX_DAYS.join(", ")} days, capped near a month for a 12-week course. A review sitting is at most ${REVIEW_PER_DAY} items, mixed so no more than two in a row come from one lesson.`,
    source: [
      { label: "Cepeda et al. 2008", href: "https://www.evullab.org/pdf/CepedaVulRohrerWixtedPashler-PS-2008.pdf" },
      { label: "Rohrer & Taylor", href: "https://digitalcommons.usf.edu/psy_facpub/1767/" },
      { label: "Leitner system", href: "https://en.wikipedia.org/wiki/Leitner_system" },
    ],
  },
  {
    title: "A lucky guess isn't knowing it",
    body: "Ticking \"I'm guessing\" before you answer means a right guess still counts as a miss and comes back tomorrow. Only your first try scores; retrying until right is encouraged but doesn't move an item up. (A design choice in the spirit of the review research, not a separately tested finding.)",
    source: [],
  },
  {
    title: "Target the usual wrong ideas",
    body: "The wrong answers on offer are the common novice beliefs: that = compares, that b = a copies an object, that const means nothing can change, that == and === are the same, that code after return still runs, that TypeScript checks types while the app runs.",
    source: [
      { label: "Progmiscon misconception list", href: "https://progmiscon.org/misconceptions/" },
      { label: "MDN on equality", href: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Equality_comparisons_and_sameness" },
    ],
  },
  {
    title: "A high bar to move on",
    body: `Mastery programs work best when the bar is high. A phase's checkpoint needs ${Math.round(CHECKPOINT_PASS * 100)}% right on the first try before the next phase opens.`,
    source: [{ label: "Kulik et al., mastery learning meta-analysis", href: "https://www.academia.edu/81783373/Effectiveness_of_Mastery_Learning_Programs_A_Meta_Analysis" }],
  },
  {
    title: "Your own kind of code",
    body: "Courses built around a context learners care about raised pass rates sharply for non-majors. Examples here use campsites, rigs and load-ins, and 1.11 reads code shaped like CampHawk's.",
    source: [{ label: "Porter et al.", href: "https://files.software-carpentry.org/training-course/2013/08/p34-porter.pdf" }],
  },
  {
    title: "Made for a phone first",
    body: "Typing code with symbols on a touchscreen is the slow part, so most steps are tap-to-answer: choose, tap a line, tap lines into order. \"Run it\" steps need typing and are easier on a computer.",
    source: [{ label: "Mobile programming survey", href: "https://arxiv.org/pdf/1708.05805" }],
  },
];

export default async function Method() {
  await requirePrivate("/private/learn/method");
  return (
    <LearnShell current="/private/learn/method">
      <div className="max-w-[760px]">
        <Label>How it teaches</Label>
        <h1 className="mt-3 text-title font-normal">Built on how people actually learn to read code.</h1>
        <p className="mt-3 text-lede text-ink-2">
          Each rule below is something the lessons do, and why. Some of the studies are small, so treat their numbers as a direction rather than a promise.
        </p>
      </div>
      <ol className="mt-12 grid max-w-[760px] gap-10">
        {RULES.map((r, i) => (
          <li key={r.title} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[3rem_minmax(0,1fr)]">
            <span aria-hidden="true" className="pt-1 font-mono text-label tabular-nums text-muted">{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h2 className="text-h3 font-medium">{r.title}</h2>
              <p className="mt-2 text-body text-ink-2">{r.body}</p>
              {r.source.length > 0 && <p className="mt-2 text-small text-muted">
                {r.source.map((s, j) => (
                  <span key={s.href}>
                    {j > 0 && " · "}
                    <a href={s.href} target="_blank" rel="noreferrer" className="underline underline-offset-4 hover:text-ink">{s.label}</a>
                  </span>
                ))}
              </p>}
            </div>
          </li>
        ))}
      </ol>
    </LearnShell>
  );
}

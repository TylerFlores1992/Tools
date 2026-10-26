# Learn to read code (`/private/learn`)

Built 2026-10-26. The owner builds by directing Claude and can't read code yet; this course gets
him to the point where he can pass AI-training coding assessments (review AI code, find bugs, say
which of two solutions is better). Owner's picks: Private tab, free AI feedback, progress synced
across devices, Phase 1 first.

## What's there
| Page | What |
|---|---|
| `/private/learn` | Home: review due, next lesson, lessons done, solid items, days studied this week, the four phases |
| `/private/learn/<lesson-id>` | One lesson, a step at a time; reopens at the last step on any device |
| `/private/learn/review` | Today's spaced review: up to 15 items, mixed across lessons |
| `/private/learn/method` | The research behind it, with sources |

Phase 1 (weeks 1–3): lessons 1.1–1.11 and the 1.12 checkpoint. **Practice quizzes** (owner's ask,
2026-10-26): three per lesson 1.1–1.11, four tap-and-type questions each: Quick check, Practice
(new examples), Mixed refresher (with earlier lessons). Data in `lessons/phase1-quizzes.ts`; each
quiz plays like a lesson at `/private/learn/<lesson>--quiz-<n>`, feeds the same review boxes, and
shows as a Quiz 1/2/3 button under its lesson. They aren't on the course path (don't gate phases). Phases 2–4 are listed with no
lessons yet. **Next:** write Phase 2 (React and Next.js, traced through CampHawk) in
`src/tools/learn/lessons/phase2.ts` and add it to `PHASES` in `lessons/index.ts`.

## How a lesson works (and why: `/private/learn/method`)
Warm-up from the last lesson → worked example with subgoal notes (▸) → predict → trace table →
put lines in order (Parsons) → tap the bug → compare two solutions → change code and run it →
explain it in plain English. Tap-to-answer everywhere except "Run it" and "Explain".
- Only the **first try** per step counts; "I'm guessing" makes a right guess count as a miss.
- **Review boxes** (Leitner): right moves up, wrong goes to box 1; gaps 1/3/7/14/30 days
  (`BOX_DAYS` in `check.ts`). First seen right → box 2, wrong → box 1.
- **Checkpoint** needs 90% first-try to open the next phase (`CHECKPOINT_PASS`).
- **Explain** steps: Gemini marks each rubric point and hints at what's missing; the model answer
  shows only when every point is met or on request (hint-first: Bastani et al.). No key, no quota or
  a slow model → "mark it yourself" against the rubric.
- **Run it**: the learner's JavaScript runs in a throwaway Web Worker in the browser, killed after
  2 s. Plain JS only (no TypeScript syntax in Run steps).

## Where the code is
| What | Where |
|---|---|
| Lesson data (one file per batch of lessons) | `src/tools/learn/lessons/` |
| Marking, review schedule, interleaving (pure, tested) | `src/tools/learn/check.ts`, `progress.ts`, `grade.ts` |
| Tests, including running every lesson's code for real | `src/tools/learn/learn.test.mts` |
| Players and step UI | `src/tools/learn/ui/` |
| DB reads/writes, AI marker | `src/lib/learn/store.ts`, `src/lib/learn/ai.ts` |
| Pages + Server Actions | `src/app/private/learn/` |
| Schema (record) | `docs/sql/learn-schema.sql` |

**Writing a lesson:** copy an existing one. The tests check that every predict answer is what the
code really prints, every trace row is the real value, every Run step's solution passes and its
starter doesn't. Write predict/trace code in plain JS where you can so the tests can check it.
Step ids are stable: they key the review boxes, so renaming one orphans its history.

## Data
`learn` schema in the CampHawk Supabase project (same as `money` and `mail`), `money_app` only,
not exposed to the Data API. Tables: `lessons` (where you are, first-try score), `items` (review
box + due date per step), `attempts` (every answer, AI feedback as JSON). Applied 2026-10-26 as
migration `learn_schema`; grants checked (only `money_app`).

## Environment
Nothing new. `MONEY_DATABASE_URL` for progress. The AI marker uses `LEARN_GEMINI_API_KEY` if set,
else Morning Mail's `MAIL_GEMINI_API_KEY` (free Google AI Studio key; the free tier may use what is
sent, which is only lesson text and the answer). `LEARN_GEMINI_MODEL` to pin a model, `LEARN_AI=off`
to turn the marker off.

## Status (2026-10-26)
Walked through end to end in Chrome against a local Postgres (phone dark, desktop light): answers
save, boxes and due dates are right, lessons resume. **The AI marker is untested against the real
key** (it lives only in Vercel); it falls back to self-marking on any failure.

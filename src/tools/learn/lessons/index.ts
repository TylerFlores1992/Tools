import type { GradedStep, Lesson, Phase, Step } from "../types";
import { PHASE_1 } from "./phase1";

/**
 * The course: four phases over about twelve weeks (the plan in the owner's "Learn to Read Code"
 * doc). Phase 1 is written; later phases are listed so the road ahead is visible, and get their
 * lessons in later sessions.
 */
export const PHASES: readonly Phase[] = [
  PHASE_1,
  {
    id: "react",
    number: 2,
    title: "React and Next.js",
    weeks: "Weeks 4–6",
    summary: "Components, props, state and effects, and how a Next.js page and an API route fit together, traced through CampHawk.",
    lessons: [],
  },
  {
    id: "async",
    number: 3,
    title: "Async, APIs and debugging",
    weeks: "Weeks 7–9",
    summary: "Promises, async/await, fetch and status codes, reading error messages, and the bugs that show up most.",
    lessons: [],
  },
  {
    id: "review",
    number: 4,
    title: "Review AI code like the gig",
    weeks: "Weeks 10–12",
    summary: "Compare two solutions, rate code on correctness, readability, edge cases and safety, and write the explanation a reviewer would.",
    lessons: [],
  },
];

export const ALL_LESSONS: readonly Lesson[] = PHASES.flatMap((p) => p.lessons);

export const lessonById = (id: string): Lesson | undefined => ALL_LESSONS.find((l) => l.id === id);

export function findStep(lessonId: string, stepId: string): Step | undefined {
  return lessonById(lessonId)?.steps.find((s) => s.id === stepId);
}

export function phaseOf(lessonId: string): Phase | undefined {
  return PHASES.find((p) => p.lessons.some((l) => l.id === lessonId));
}

export function gradedStep(lessonId: string, stepId: string): GradedStep | undefined {
  const s = findStep(lessonId, stepId);
  return s && s.kind !== "learn" ? s : undefined;
}

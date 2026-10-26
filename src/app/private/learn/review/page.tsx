import type { Metadata } from "next";
import Link from "next/link";
import { Arrow, buttonClasses } from "@/components/Button";
import { Label } from "@/components/Label";
import { loadProgress } from "@/lib/learn/store";
import { requirePrivate } from "@/lib/money/guard";
import { interleave, REVIEW_PER_DAY, seededShuffle } from "@/tools/learn/check";
import { gradedStep, lessonById } from "@/tools/learn/lessons";
import { dueItems, nextDue } from "@/tools/learn/progress";
import { LearnNotConfigured, LearnShell, LearnUnreachable } from "@/tools/learn/ui/LearnShell";
import { ReviewPlayer, type ReviewItem } from "@/tools/learn/ui/ReviewPlayer";

export const metadata: Metadata = {
  title: "Review",
  description: "Today's spaced review.",
  robots: { index: false, follow: false },
};

const longDay = (d: string) => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));

export default async function ReviewPage() {
  await requirePrivate("/private/learn/review");
  const data = await loadProgress();
  if (data.state !== "ok") {
    return (
      <LearnShell current="/private/learn/review">
        {data.state === "not-configured" ? <LearnNotConfigured /> : <LearnUnreachable />}
      </LearnShell>
    );
  }

  const stepOf = (lessonId: string, itemId: string) => gradedStep(lessonId, itemId.slice(lessonId.length + 1));
  const due = dueItems(data.items, data.today, (l, i) => Boolean(stepOf(l, i)));
  // Oldest first so nothing waits forever; a long backlog is split so one sitting stays short (the
  // rest stays due). Then mixed: shuffled, with at most two in a row from one lesson.
  const picked = interleave(seededShuffle(due.slice(0, REVIEW_PER_DAY), data.today), (it) => it.lessonId);
  const queue: ReviewItem[] = picked.flatMap((it) => {
    const step = stepOf(it.lessonId, it.itemId);
    const lesson = lessonById(it.lessonId);
    return step && lesson ? [{ lessonId: it.lessonId, lessonTitle: `${lesson.number} ${lesson.title}`, step }] : [];
  });

  if (!queue.length) {
    const soon = nextDue(data.items, data.today);
    return (
      <LearnShell current="/private/learn/review">
        <div className="max-w-[640px]">
          <Label>Review</Label>
          <h1 className="mt-3 text-title font-normal">Nothing due today.</h1>
          <p className="mt-3 text-lede text-ink-2">
            {data.items.length ? `The next review is ${soon ? longDay(soon) : "not scheduled yet"}. Answers from lessons come back here on a schedule: missed ones the next day, right ones further out each time.` : "Answers from lessons land here and come back on a schedule. Do a lesson first."}
          </p>
          <Link href="/private/learn" className={buttonClasses("primary", "mt-8")}>
            Back to lessons <Arrow />
          </Link>
        </div>
      </LearnShell>
    );
  }

  return (
    <LearnShell current="/private/learn/review">
      <div className="max-w-[760px]">
        <Label>Review · {queue.length} today{due.length > queue.length ? ` (${due.length - queue.length} more wait for the next sitting)` : ""}</Label>
      </div>
      <div className="mt-4">
        <ReviewPlayer items={queue} />
      </div>
    </LearnShell>
  );
}

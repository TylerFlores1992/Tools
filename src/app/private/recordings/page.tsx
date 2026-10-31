import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { Arrow, buttonClasses } from "@/components/Button";
import { Card } from "@/components/Card";
import { cx } from "@/components/cx";
import { Label } from "@/components/Label";
import { State } from "@/components/State";
import { requirePrivate } from "@/lib/money/guard";
import { dvr } from "@/lib/recordings/dvr";
import { adsText, clash, clock, groupByDay, padText, plural, relIn, shortDate, size, when } from "@/tools/recordings/format";
import type { DvrState, Episode, Rule, Show, Upcoming } from "@/tools/recordings/types";
import { Confirm } from "@/tools/recordings/ui/Confirm";
import { RecordingsShell } from "@/tools/recordings/ui/RecordingsShell";
import { Tag } from "@/tools/money/ui/MoneyShell";
import { PendingButton } from "@/tools/mail/ui/PendingButton";
import {
  cancelOnce, deleteEpisode, deleteSeries, deleteShow, emptyTrash, restoreAds, saveDefaults, setPaused, skipEpisode, stopRecording, undelete, unskipEpisode,
} from "./actions";

export const metadata: Metadata = {
  title: "Recordings",
  description: "The home DVR: what's coming up, what's recorded, and what to record next.",
  robots: { index: false, follow: false },
};

type Tab = "upcoming" | "library" | "series" | "trash";
const TABS: readonly Tab[] = ["upcoming", "library", "series", "trash"];
const TAB_LABEL: Record<Tab, string> = { upcoming: "Upcoming", library: "Library", series: "Series", trash: "Trash" };

const small = (extra?: string) => buttonClasses("ghost", cx("min-h-10 px-3 text-small", extra));
const quietSmall = (extra?: string) => buttonClasses("quiet", cx("min-h-10 px-4 text-small", extra));

export default async function Recordings({ searchParams }: { searchParams: Promise<{ tab?: string; msg?: string; kind?: string; undo?: string; unskip?: string }> }) {
  await requirePrivate("/private/recordings");
  const sp = await searchParams;
  const r = await dvr<DvrState>("state");

  if (!r.ok) {
    return (
      <RecordingsShell>
        <h1 className="text-title font-normal">Recordings</h1>
        <Card className="mt-8 max-w-[640px]">
          <State kind={r.reason === "not-configured" ? "note" : "wrong"}>{r.message}</State>
          {r.reason === "not-configured" && (
            <p className="mt-3 text-body text-ink-2">
              The site needs <code className="font-mono text-small">DVR_URL</code> and <code className="font-mono text-small">DVR_TOKEN</code> in Vercel. Setup is in{" "}
              <code className="font-mono text-small">docs/RECORDINGS.md</code>.
            </p>
          )}
        </Card>
      </RecordingsShell>
    );
  }

  const s = r.data;
  const counts: Record<Tab, number> = {
    upcoming: s.upcoming.filter((u) => u.state !== "skipped").length,
    library: s.library.reduce((n, sh) => n + sh.episodes.length, 0),
    series: s.rules.filter((x) => !x.once).length,
    trash: s.trash.length,
  };
  let tab: Tab = TABS.includes(sp.tab as Tab) ? (sp.tab as Tab) : "upcoming";
  if (tab === "trash" && !s.trash.length) tab = "library";
  const tabs = TABS.filter((t) => t !== "trash" || s.trash.length > 0);

  return (
    <RecordingsShell>
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-[640px]">
          <Label rule>Home DVR</Label>
          <h1 className="mt-3 text-title font-normal">Recordings</h1>
          <p className="mt-3 text-lede text-ink-2">Shows record at home and turn up under ★ Recordings on every TV, with the ads taken out.</p>
        </div>
        <Link href="/private/recordings/record" className={buttonClasses("primary")}>
          Record a show <Arrow />
        </Link>
      </div>

      {sp.msg && (
        <div className="mt-6 flex flex-wrap items-center gap-3" role="status">
          <State kind={sp.kind === "wrong" ? "wrong" : "ok"}>{sp.msg}</State>
          {sp.undo && /^[a-z0-9]{6,20}$/.test(sp.undo) && (
            <form action={undelete}>
              <input type="hidden" name="id" value={sp.undo} />
              <input type="hidden" name="tab" value={tab} />
              <PendingButton className={quietSmall()} pending="Restoring…">Undo</PendingButton>
            </form>
          )}
          {sp.unskip && /^\d+\|\d+$/.test(sp.unskip) && (
            <form action={unskipEpisode}>
              <input type="hidden" name="key" value={sp.unskip} />
              <PendingButton className={quietSmall()} pending="Undoing…">Undo</PendingButton>
            </form>
          )}
        </div>
      )}

      <Stats s={s} />

      <nav aria-label="Recordings" className="mt-10 overflow-x-auto">
        <ul className="inline-flex gap-1 rounded-full border border-line bg-surface p-1">
          {tabs.map((t) => (
            <li key={t}>
              <Link
                href={`/private/recordings?tab=${t}`}
                aria-current={tab === t ? "page" : undefined}
                className="flex min-h-10 items-center gap-2 rounded-full px-4 text-small whitespace-nowrap text-ink-2 transition-colors duration-150 hover:text-ink aria-[current=page]:bg-primary aria-[current=page]:text-on-primary"
              >
                {TAB_LABEL[t]}
                {counts[t] > 0 && <span className="tabular-nums">{counts[t]}</span>}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6 max-w-[920px]">
        {tab === "upcoming" && <UpcomingTab s={s} />}
        {tab === "library" && <LibraryTab s={s} />}
        {tab === "series" && <SeriesTab s={s} />}
        {tab === "trash" && <TrashTab s={s} />}
      </div>
    </RecordingsShell>
  );
}

// ---------- top tiles ----------

function Tile({ label, children, note }: { label: string; children: ReactNode; note?: ReactNode }) {
  return (
    <Card className="min-w-0">
      <p className="font-mono text-label uppercase text-ink-2">{label}</p>
      <div className="mt-2 text-h3 font-medium">{children}</div>
      {note && <p className="mt-1 text-small text-muted">{note}</p>}
    </Card>
  );
}

function Stats({ s }: { s: DvrState }) {
  const rec = s.upcoming.filter((u) => u.state === "recording");
  const next = s.upcoming.find((u) => u.state === "scheduled");
  const eps = s.library.reduce((n, sh) => n + sh.episodes.length, 0);
  const bytes = s.library.reduce((n, sh) => n + sh.size, 0);
  const watching = s.rules.filter((x) => x.enabled && !x.once).length;
  const lowDisk = s.disk && s.disk.free < 50e9;
  return (
    <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {rec.length ? (
        rec.map((u) => (
          <Tile key={u.key} label="Recording now" note={`${u.channelName} · ${size(u.mb * 1048576)} so far · ends ${clock(u.until)}`}>
            <State kind="ok" sr="Recording:">{u.show}{u.se ? ` ${u.se}` : ""}</State>
          </Tile>
        ))
      ) : (
        <Tile label="Recording now" note={watching ? `Watching for ${plural(watching, "series")}` : "No series set up yet"}>
          <span className="text-ink-2">Nothing right now</span>
        </Tile>
      )}
      <Tile label="Next up" note={next ? `${when(next.start, s.now)} · ${relIn(next.from, s.now)}` : s.guideEnd ? `The guide reaches ${shortDate(s.guideEnd)}` : undefined}>
        {next ? next.show : <span className="text-ink-2">Nothing scheduled</span>}
      </Tile>
      <Tile label="Library" note={size(bytes)}>
        <span className="tabular-nums">{plural(eps, "episode")}</span>
      </Tile>
      {s.disk && (
        <Tile label="Free space" note={`of ${size(s.disk.total)} · about ${Math.floor(s.disk.free / 2.5e9)} h of TV`}>
          {lowDisk ? <State kind="wrong" sr="Low:">{size(s.disk.free)} left</State> : <span className="tabular-nums">{size(s.disk.free)}</span>}
        </Tile>
      )}
    </div>
  );
}

// ---------- upcoming ----------

function UpcomingTab({ s }: { s: DvrState }) {
  const guide = s.guideEnd ? `The TV guide reaches ${shortDate(s.guideEnd)}; later airings appear here as it fills in.` : "";
  if (!s.upcoming.length) {
    const n = s.rules.filter((x) => x.enabled && !x.once).length;
    return (
      <Card>
        <h2 className="text-h3 font-medium">Nothing scheduled yet</h2>
        <p className="mt-2 max-w-[60ch] text-body text-ink-2">
          {n ? `Your ${plural(n, "series")} ${n === 1 ? "is" : "are"} being watched for new episodes. ${guide}` : "Find a show in the guide and choose how to record it."}
        </p>
        <Link href="/private/recordings/record" className={buttonClasses("quiet", "mt-5")}>Record a show <Arrow /></Link>
      </Card>
    );
  }
  return (
    <div className="grid gap-8">
      {groupByDay(s.upcoming, s.now).map((g) => (
        <section key={g.label} aria-label={g.label}>
          <Label>{g.label}</Label>
          <ul className="mt-3 rounded-card border border-line bg-surface shadow-card">
            {g.items.map((u) => <UpcomingRow key={u.key} u={u} lines={s.lines} />)}
          </ul>
        </section>
      ))}
      {guide && <p className="text-small text-muted">{guide}</p>}
    </div>
  );
}

function UpcomingRow({ u, lines }: { u: Upcoming; lines: number }) {
  const name = [u.show, u.se].filter(Boolean).join(" ");
  const warn = clash(u, lines);
  return (
    <li className="flex flex-wrap items-start gap-x-5 gap-y-3 border-t border-line px-5 py-4 first:border-t-0">
      <div className="w-24 shrink-0 tabular-nums">
        <p className={cx("text-body font-medium", u.state === "skipped" ? "text-muted line-through" : "text-ink")}>{clock(u.start)}</p>
        <p className="text-small text-muted">to {clock(u.stop)}</p>
      </div>
      <div className="min-w-0 flex-1 basis-60">
        <p className="flex flex-wrap items-baseline gap-x-2 text-body">
          <span className={u.state === "skipped" ? "text-muted line-through" : "text-ink"}>{u.show}</span>
          {u.se && <Tag>{u.se}</Tag>}
          {u.sub && <span className="text-small text-ink-2">{u.sub}</span>}
        </p>
        <p className="mt-1 text-small text-muted">{u.channelName} · records {clock(u.from)}–{clock(u.until)}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {u.state === "recording" && <State kind="ok" sr="Status:" className="text-small">Recording · {size(u.mb * 1048576)} so far</State>}
          {u.state === "skipped" && <State kind="note" sr="Status:" className="text-small">Skipped</State>}
          {u.isNew && <Tag>New</Tag>}
          {u.once && <Tag>One time</Tag>}
          {warn && <State kind="wrong" sr="Warning:" className="text-small">{warn}</State>}
        </div>
      </div>
      <div className="flex shrink-0 items-start gap-1">
        {u.state === "recording" ? (
          <Confirm label="Stop" danger>
            <p>Stop recording {name} now? What&rsquo;s recorded so far is kept.</p>
            <form action={stopRecording}>
              <input type="hidden" name="key" value={u.key} />
              <PendingButton className={quietSmall()} pending="Stopping…">Stop recording</PendingButton>
            </form>
          </Confirm>
        ) : u.once && u.ruleId ? (
          <form action={cancelOnce}>
            <input type="hidden" name="id" value={u.ruleId} />
            <input type="hidden" name="name" value={name} />
            <PendingButton className={small()} pending="Canceling…">Cancel</PendingButton>
          </form>
        ) : u.state === "skipped" ? (
          <form action={unskipEpisode}>
            <input type="hidden" name="key" value={u.key} />
            <input type="hidden" name="name" value={name} />
            <PendingButton className={quietSmall()} pending="Saving…">Record it</PendingButton>
          </form>
        ) : (
          <form action={skipEpisode}>
            <input type="hidden" name="key" value={u.key} />
            <input type="hidden" name="name" value={name} />
            <PendingButton className={small()} pending="Skipping…">Skip</PendingButton>
          </form>
        )}
      </div>
    </li>
  );
}

// ---------- library ----------

function LibraryTab({ s }: { s: DvrState }) {
  return (
    <div className="grid gap-6">
      {s.failed.length > 0 && (
        <Card>
          <State kind="wrong" sr="Problem:">{plural(s.failed.length, "recording")} didn&rsquo;t work out</State>
          <ul className="mt-2 grid gap-1 text-small text-ink-2">
            {s.failed.map((f, i) => (
              <li key={i}>{f.show} {f.se} ({shortDate(Date.parse(f.aired))}): {f.why}</li>
            ))}
          </ul>
        </Card>
      )}
      {!s.library.length ? (
        <Card>
          <h2 className="text-h3 font-medium">No recordings yet</h2>
          <p className="mt-2 text-body text-ink-2">Recorded shows land here and under ★ Recordings on every TV.</p>
        </Card>
      ) : (
        s.library.map((sh) => <ShowCard key={sh.show} sh={sh} rule={s.rules.find((x) => !x.once && x.folder.toLowerCase() === sh.show.toLowerCase())} />)
      )}
      <p className="text-small text-muted">Deleted recordings stay in the Trash for 7 days. Ad removal keeps the full version for 7 days too, in case it cut too much.</p>
    </div>
  );
}

function ShowCard({ sh, rule }: { sh: Show; rule?: Rule }) {
  return (
    <section aria-label={sh.show} className="rounded-card border border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-h3 font-medium">{sh.show}</h2>
          <p className="text-small text-muted">{plural(sh.episodes.length, "episode")} · {size(sh.size)}</p>
        </div>
        <Confirm label="Delete all" danger>
          <p>Move all {plural(sh.episodes.length, "episode")} of {sh.show} ({size(sh.size)}) to the Trash? You can restore them for 7 days.</p>
          <form action={deleteShow} className="grid gap-3">
            <input type="hidden" name="show" value={sh.show} />
            {sh.episodes.map((e) => <input key={e.rel} type="hidden" name="rel" value={e.rel} />)}
            {rule && (
              <label className="flex min-h-11 items-center gap-3">
                <input type="checkbox" name="stopSeries" value="1" className="size-5 accent-primary" />
                <input type="hidden" name="ruleId" value={rule.id} />
                Also stop recording new episodes
              </label>
            )}
            <PendingButton className={quietSmall("justify-self-start")} pending="Deleting…">Delete all</PendingButton>
          </form>
        </Confirm>
      </header>
      <ul>
        {sh.episodes.map((e) => <EpisodeRow key={e.rel} e={e} />)}
      </ul>
    </section>
  );
}

function EpisodeRow({ e }: { e: Episode }) {
  const ads = adsText(e.ads);
  const name = [e.show, e.se].filter(Boolean).join(" ");
  const bits = [e.aired ? `Aired ${shortDate(Date.parse(e.aired))}` : `Added ${shortDate(e.added)}`, e.minutes ? `${e.minutes} min` : "", size(e.size)].filter(Boolean).join(" · ");
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 border-t border-line px-5 py-4 first:border-t-0">
      <div className="min-w-0 flex-1 basis-60">
        <p className="flex flex-wrap items-baseline gap-x-2 text-body text-ink">
          {e.se && <Tag>{e.se}</Tag>}
          <span className="break-words">{e.title || e.show}</span>
        </p>
        <p className="mt-1 text-small text-muted">{bits}</p>
        <p className="mt-2 text-small"><State kind={ads.kind} sr="Ads:">{ads.text}</State></p>
      </div>
      <div className="flex shrink-0 flex-wrap items-start gap-1">
        {e.ads.canRestore && (
          <Confirm label="Put ads back">
            <p>Swap in the full recording, ads included? Use this if the ad removal cut part of the show. The ad-free copy goes to the Trash.</p>
            <form action={restoreAds}>
              <input type="hidden" name="rel" value={e.rel} />
              <input type="hidden" name="name" value={name} />
              <PendingButton className={quietSmall()} pending="Swapping…">Put ads back</PendingButton>
            </form>
          </Confirm>
        )}
        <form action={deleteEpisode}>
          <input type="hidden" name="rel" value={e.rel} />
          <input type="hidden" name="name" value={name} />
          <PendingButton className={small("hover:text-wrong")} pending="Deleting…">Delete</PendingButton>
        </form>
      </div>
    </li>
  );
}

// ---------- series ----------

function SeriesTab({ s }: { s: DvrState }) {
  const rules = s.rules.filter((x) => !x.once);
  return (
    <div className="grid gap-6">
      {!rules.length ? (
        <Card>
          <h2 className="text-h3 font-medium">No series yet</h2>
          <p className="mt-2 text-body text-ink-2">Pick a show and every new episode records by itself, with nothing to schedule week by week.</p>
          <Link href="/private/recordings/record" className={buttonClasses("quiet", "mt-5")}>Record a show <Arrow /></Link>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rules.map((x) => <SeriesCard key={x.id} x={x} s={s} />)}
        </div>
      )}
      <Card>
        <h2 className="text-h3 font-medium">Default timing</h2>
        <p className="mt-2 text-small text-ink-2">Every series starts recording a little early and keeps going after the guide says it ends, because shows often run over. A series can have its own timing.</p>
        <form action={saveDefaults} className="mt-4 flex flex-wrap items-end gap-4">
          <Pick name="padBeforeMin" label="Start early" value={s.defaults.padBeforeMin} options={[0, 1, 2, 3, 5, 10]} />
          <Pick name="padAfterMin" label="End late" value={s.defaults.padAfterMin} options={[0, 5, 10, 15, 20, 30, 45, 60]} />
          <PendingButton className={quietSmall("min-h-11")} pending="Saving…">Save</PendingButton>
        </form>
      </Card>
    </div>
  );
}

function Pick({ name, label, value, options }: { name: string; label: string; value: number; options: number[] }) {
  return (
    <label className="grid gap-1.5 text-small text-ink-2">
      {label}
      <select name={name} defaultValue={value} className="min-h-11 rounded-input border border-control bg-surface px-3 text-body text-ink">
        {options.map((o) => <option key={o} value={o}>{o} min</option>)}
      </select>
    </label>
  );
}

function SeriesCard({ x, s }: { x: Rule; s: DvrState }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-h3 font-medium break-words">{x.title}</h2>
          <p className="text-small text-muted">{x.channelName}</p>
        </div>
        <State kind={x.enabled ? "ok" : "note"} sr="Status:" className="shrink-0 text-small">{x.enabled ? "Recording" : "Paused"}</State>
      </div>
      <div className="flex flex-wrap gap-2">
        <Tag>{x.newOnly ? "New episodes only" : "Every airing"}</Tag>
        <Tag>{x.keep ? `Keep latest ${x.keep}` : "Keep all"}</Tag>
        <Tag>{padText(x, s.defaults)}</Tag>
      </div>
      <p className="text-small text-ink-2">
        {!x.enabled ? "Nothing records while it's paused." : x.next ? <>Next: <span className="text-ink">{when(x.next, s.now)}</span></> : "No new episode in the guide yet."}
      </p>
      <div className="mt-auto flex flex-wrap items-start justify-between gap-2 border-t border-line pt-3">
        <span className="py-2 text-small text-muted">{plural(x.episodes, "episode")} recorded</span>
        <div className="flex flex-wrap items-start gap-1">
          <Link href={`/private/recordings/record?show=${encodeURIComponent(x.title)}&edit=${x.id}`} className={small()}>Edit</Link>
          <form action={setPaused}>
            <input type="hidden" name="id" value={x.id} />
            <input type="hidden" name="name" value={x.title} />
            <input type="hidden" name="resume" value={x.enabled ? "0" : "1"} />
            <PendingButton className={small()} pending="Saving…">{x.enabled ? "Pause" : "Resume"}</PendingButton>
          </form>
          <Confirm label="Delete" danger>
            <p>Stop recording {x.title}? No more episodes will record.</p>
            <form action={deleteSeries} className="grid gap-2">
              <input type="hidden" name="id" value={x.id} />
              <input type="hidden" name="name" value={x.title} />
              {x.episodes > 0 && (
                <>
                  <label className="flex min-h-11 items-center gap-3">
                    <input type="radio" name="deleteRecordings" value="0" defaultChecked className="size-5 accent-primary" />
                    Keep the {plural(x.episodes, "recorded episode")}
                  </label>
                  <label className="flex min-h-11 items-center gap-3">
                    <input type="radio" name="deleteRecordings" value="1" className="size-5 accent-primary" />
                    Delete them too (Trash, 7 days)
                  </label>
                </>
              )}
              <PendingButton className={quietSmall("justify-self-start")} pending="Stopping…">Stop recording</PendingButton>
            </form>
          </Confirm>
        </div>
      </div>
    </Card>
  );
}

// ---------- trash ----------

function TrashTab({ s }: { s: DvrState }) {
  const total = s.trash.reduce((n, t) => n + t.size, 0);
  return (
    <div className="grid gap-6">
      <p className="text-body text-ink-2">Items here are deleted for good 7 days after they were removed. Until then, Restore puts them back where they were, on every TV.</p>
      <ul className="rounded-card border border-line bg-surface shadow-card">
        {[...s.trash].reverse().map((t) => (
          <li key={t.id} className="flex flex-wrap items-start justify-between gap-x-5 gap-y-2 border-t border-line px-5 py-4 first:border-t-0">
            <div className="min-w-0 flex-1 basis-60">
              <p className="break-words text-body text-ink">{t.name}</p>
              <p className="mt-1 text-small text-muted">
                Deleted {when(Date.parse(t.deletedAt), s.now)}{t.why ? ` · ${t.why}` : ""} · {size(t.size)} · gone for good {relIn(t.purgeAt, s.now)}
              </p>
            </div>
            <form action={undelete}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="tab" value="trash" />
              <PendingButton className={quietSmall()} pending="Restoring…">Restore</PendingButton>
            </form>
          </li>
        ))}
      </ul>
      <Confirm label={`Empty trash (${size(total)})`} danger className="justify-self-start">
        <p>Delete {plural(s.trash.length, "item")} for good? This can&rsquo;t be undone.</p>
        <form action={emptyTrash}>
          <PendingButton className={quietSmall()} pending="Deleting…">Delete for good</PendingButton>
        </form>
      </Confirm>
    </div>
  );
}
